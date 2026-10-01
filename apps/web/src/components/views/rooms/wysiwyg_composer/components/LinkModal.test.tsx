/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { type FormattingFunctions } from "@vector-im/matrix-wysiwyg";
import { render, screen, waitFor } from "test-utils-rtl";
import React from "react";
import userEvent from "@testing-library/user-event";

import { mockPlatformPeg } from "test-utils";
import { LinkModal } from "./LinkModal";
import * as selection from "../utils/selection";
import { type SubSelection } from "../types";

describe("LinkModal", () => {
    const formattingFunctions = {
        link: vi.fn(),
        removeLinks: vi.fn(),
        getLink: vi.fn().mockReturnValue("my initial content"),
    } as unknown as FormattingFunctions;
    const defaultValue: SubSelection = {
        focusNode: null,
        anchorNode: null,
        focusOffset: 3,
        anchorOffset: 4,
        isForward: true,
    };

    const customRender = (isTextEnabled: boolean, onFinished: () => void, isEditing = false) => {
        return render(
            <LinkModal
                composer={formattingFunctions}
                isTextEnabled={isTextEnabled}
                onFinished={onFinished}
                composerContext={{ selection: defaultValue }}
                isEditing={isEditing}
            />,
        );
    };

    const selectionSpy = vi.spyOn(selection, "setSelection");

    beforeEach(() => mockPlatformPeg({ overrideBrowserShortcuts: vi.fn().mockReturnValue(false) }));
    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("Should create a link", async () => {
        // When
        const onFinished = vi.fn();
        customRender(false, onFinished);

        // Then
        expect(screen.getByLabelText("Link")).toBeTruthy();
        expect(screen.getByText("Save")).toBeDisabled();

        // When
        await userEvent.type(screen.getByLabelText("Link"), "l");

        // Then
        await waitFor(() => {
            expect(screen.getByText("Save")).toBeEnabled();
            expect(screen.getByLabelText("Link")).toHaveAttribute("value", "l");
        });

        // When
        vi.useFakeTimers();
        screen.getByText("Save").click();
        await vi.runAllTimersAsync();

        // Then
        expect(selectionSpy).toHaveBeenCalledWith(defaultValue);
        expect(onFinished).toHaveBeenCalledTimes(1);

        // Then
        expect(formattingFunctions.link).toHaveBeenCalledWith("l", undefined);
    });

    it("Should create a link with text", async () => {
        // When
        const onFinished = vi.fn();
        customRender(true, onFinished);

        // Then
        expect(screen.getByLabelText("Text")).toBeTruthy();
        expect(screen.getByLabelText("Link")).toBeTruthy();
        expect(screen.getByText("Save")).toBeDisabled();

        // When
        await userEvent.type(screen.getByLabelText("Text"), "t");

        // Then
        await waitFor(() => {
            expect(screen.getByText("Save")).toBeDisabled();
            expect(screen.getByLabelText("Text")).toHaveAttribute("value", "t");
        });

        // When
        await userEvent.type(screen.getByLabelText("Link"), "l");

        // Then
        await waitFor(() => {
            expect(screen.getByText("Save")).toBeEnabled();
            expect(screen.getByLabelText("Link")).toHaveAttribute("value", "l");
        });

        // When
        vi.useFakeTimers();
        screen.getByText("Save").click();
        await vi.runAllTimersAsync();

        // Then
        expect(selectionSpy).toHaveBeenCalledWith(defaultValue);
        expect(onFinished).toHaveBeenCalledTimes(1);

        // Then
        expect(formattingFunctions.link).toHaveBeenCalledWith("l", "t");
    });

    it("Should remove the link", async () => {
        // When
        const onFinished = vi.fn();
        customRender(true, onFinished, true);
        await userEvent.click(screen.getByText("Remove"));

        // Then
        expect(formattingFunctions.removeLinks).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it("Should display the link in editing", async () => {
        // When
        customRender(true, vi.fn(), true);

        // Then
        expect(screen.getByLabelText("Link")).toContainHTML("my initial content");
        expect(screen.getByText("Save")).toBeDisabled();

        // When
        await userEvent.type(screen.getByLabelText("Link"), "l");

        // Then
        await waitFor(() => expect(screen.getByText("Save")).toBeEnabled());
    });
});
