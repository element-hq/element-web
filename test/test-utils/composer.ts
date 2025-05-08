/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, fireEvent, type RenderResult } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

export const addTextToComposer = (container: HTMLElement, text: string) =>
    act(() => {
        // couldn't get input event on contenteditable to work
        // paste works without illegal private method access
        const pasteEvent: Partial<ClipboardEvent> = {
            clipboardData: {
                types: [],
                files: [],
                getData: (type: string) => (type === "text/plain" ? text : undefined),
            } as unknown as DataTransfer,
        };
        fireEvent.paste(container.querySelector('[role="textbox"]')!, pasteEvent);
    });

export const addTextToComposerRTL = async (renderResult: RenderResult, text: string): Promise<void> => {
    await act(async () => {
        await userEvent.click(renderResult.getByLabelText("Send a message…"));
        await userEvent.keyboard(text);
    });
};
