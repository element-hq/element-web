/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FormattingFunctions } from "@vector-im/matrix-wysiwyg";
import { render, screen, waitFor } from "jest-matrix-react";
import React from "react";
import userEvent from "@testing-library/user-event";

import { LinkModal } from "../../../../../../../src/components/views/rooms/wysiwyg_composer/components/LinkModal";
import { mockPlatformPeg } from "../../../../../../test-utils";
import * as selection from "../../../../../../../src/components/views/rooms/wysiwyg_composer/utils/selection";
import { type SubSelection } from "../../../../../../../src/components/views/rooms/wysiwyg_composer/types";

describe("LinkModal", () => {
    const formattingFunctions = {
        link: jest.fn(),
        removeLinks: jest.fn(),
        getLink: jest.fn().mockReturnValue("my initial content"),
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

    const selectionSpy = jest.spyOn(selection, "setSelection");

    beforeEach(() => mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) }));
    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it("Should create a link", async () => {
        // When
        const onFinished = jest.fn();
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
        jest.useFakeTimers();
        screen.getByText("Save").click();
        jest.runAllTimers();

        // Then
        await waitFor(() => {
            expect(selectionSpy).toHaveBeenCalledWith(defaultValue);
            expect(onFinished).toHaveBeenCalledTimes(1);
        });

        // Then
        expect(formattingFunctions.link).toHaveBeenCalledWith("l", undefined);
    });

    it("Should create a link with text", async () => {
        // When
        const onFinished = jest.fn();
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
        jest.useFakeTimers();
        screen.getByText("Save").click();
        jest.runAllTimers();

        // Then
        await waitFor(() => {
            expect(selectionSpy).toHaveBeenCalledWith(defaultValue);
            expect(onFinished).toHaveBeenCalledTimes(1);
        });

        // Then
        expect(formattingFunctions.link).toHaveBeenCalledWith("l", "t");
    });

    it("Should remove the link", async () => {
        // When
        const onFinished = jest.fn();
        customRender(true, onFinished, true);
        await userEvent.click(screen.getByText("Remove"));

        // Then
        expect(formattingFunctions.removeLinks).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it("Should display the link in editing", async () => {
        // When
        customRender(true, jest.fn(), true);

        // Then
        expect(screen.getByLabelText("Link")).toContainHTML("my initial content");
        expect(screen.getByText("Save")).toBeDisabled();

        // When
        await userEvent.type(screen.getByLabelText("Link"), "l");

        // Then
        await waitFor(() => expect(screen.getByText("Save")).toBeEnabled());
    });
});
