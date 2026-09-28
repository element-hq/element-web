/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "test-utils-rtl";

import { usePlainTextListeners } from "./usePlainTextListeners";

describe("setContent", () => {
    it("calling with a string calls the onChange argument", () => {
        const mockOnChange = vi.fn();
        const { result } = renderHook(() => usePlainTextListeners("initialContent", mockOnChange));

        const newContent = "new content";
        act(() => {
            result.current.setContent(newContent);
        });

        expect(mockOnChange).toHaveBeenCalledWith(newContent);
    });

    it("calling with no argument and no editor ref does not call onChange", () => {
        const mockOnChange = vi.fn();
        const { result } = renderHook(() => usePlainTextListeners("initialContent", mockOnChange));

        act(() => {
            result.current.setContent();
        });

        expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("calling with no argument and a valid editor ref calls onChange with the editorRef innerHTML", () => {
        const mockOnChange = vi.fn();

        // create a div to represent the editor and append some content
        const mockEditor = document.createElement("div");
        const mockEditorText = "some text content";
        const textNode = document.createTextNode(mockEditorText);
        mockEditor.appendChild(textNode);

        const { result } = renderHook(() => usePlainTextListeners("initialContent", mockOnChange));

        // @ts-ignore in order to allow us to reassign the ref without complaint
        result.current.ref.current = mockEditor;

        act(() => {
            result.current.setContent();
        });

        expect(mockOnChange).toHaveBeenCalledWith(mockEditor.innerHTML);
    });
});
