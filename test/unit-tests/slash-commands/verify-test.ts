/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { act, waitFor } from "jest-matrix-react";

import Modal, { type ComponentType, type IHandle } from "../../../src/Modal";
import { setUpCommandTest } from "./utils";
import QuestionDialog from "../../../src/components/views/dialogs/QuestionDialog";
import ErrorDialog from "../../../src/components/views/dialogs/ErrorDialog";

describe("/verify", () => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/verify`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should attempt manual verification after confirmation", async () => {
        // Given we say yes to prompt
        const spy = jest.spyOn(Modal, "createDialog");
        spy.mockReturnValue({ finished: Promise.resolve([true]) } as unknown as IHandle<ComponentType>);

        // When we run the command
        const { client, command } = setUpCommandTest(roomId, `/verify`);
        await act(() => command.run(client, roomId, null, "mydeviceid myfingerprint"));

        // Then the prompt is displayed
        expect(spy).toHaveBeenCalledWith(
            QuestionDialog,
            expect.objectContaining({ title: "Caution: manual device verification" }),
        );

        // And then we attempt the verification
        await waitFor(() =>
            expect(spy).toHaveBeenCalledWith(ErrorDialog, expect.objectContaining({ title: "Verification failed" })),
        );
    });

    it("should not do manual verification if cancelled", async () => {
        // Given we say no to prompt
        const spy = jest.spyOn(Modal, "createDialog");
        spy.mockReturnValue({ finished: Promise.resolve([false]) } as unknown as IHandle<ComponentType>);

        // When we run the command
        const { client, command } = setUpCommandTest(roomId, `/verify`);
        command.run(client, roomId, null, "mydeviceid myfingerprint");

        // Then the prompt is displayed
        expect(spy).toHaveBeenCalledWith(
            QuestionDialog,
            expect.objectContaining({ title: "Caution: manual device verification" }),
        );

        // But nothing else happens
        expect(spy).not.toHaveBeenCalledWith(ErrorDialog, expect.anything());
    });
});
