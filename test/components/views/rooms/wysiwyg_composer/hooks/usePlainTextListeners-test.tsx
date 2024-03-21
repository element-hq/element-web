/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { renderHook } from "@testing-library/react-hooks";
import { act } from "@testing-library/react";

import { usePlainTextListeners } from "../../../../../../src/components/views/rooms/wysiwyg_composer/hooks/usePlainTextListeners";

describe("setContent", () => {
    it("calling with a string calls the onChange argument", () => {
        const mockOnChange = jest.fn();
        const { result } = renderHook(() => usePlainTextListeners("initialContent", mockOnChange));

        const newContent = "new content";
        act(() => {
            result.current.setContent(newContent);
        });

        expect(mockOnChange).toHaveBeenCalledWith(newContent);
    });

    it("calling with no argument and no editor ref does not call onChange", () => {
        const mockOnChange = jest.fn();
        const { result } = renderHook(() => usePlainTextListeners("initialContent", mockOnChange));

        act(() => {
            result.current.setContent();
        });

        expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("calling with no argument and a valid editor ref calls onChange with the editorRef innerHTML", () => {
        const mockOnChange = jest.fn();

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
