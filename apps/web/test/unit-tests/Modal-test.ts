/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import Modal from "../../src/Modal";
import QuestionDialog from "../../src/components/views/dialogs/QuestionDialog";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { flushPromises } from "../test-utils";

describe("Modal", () => {
    test("forceCloseAllModals should close all open modals", () => {
        Modal.createDialog(QuestionDialog, {
            title: "Test dialog",
            description: "This is a test dialog",
            button: "Word",
        });

        expect(Modal.hasDialogs()).toBe(true);
        Modal.forceCloseAllModals();
        expect(Modal.hasDialogs()).toBe(false);
    });

    test("open modals should be closed on logout", async () => {
        const modal1OnFinished = jest.fn();
        const modal2OnFinished = jest.fn();

        Modal.createDialog(QuestionDialog, {
            title: "Test dialog 1",
            description: "This is a test dialog",
            button: "Word",
        }).finished.then(modal1OnFinished);

        Modal.createDialog(QuestionDialog, {
            title: "Test dialog 2",
            description: "This is a test dialog",
            button: "Word",
        }).finished.then(modal2OnFinished);

        defaultDispatcher.dispatch({ action: "logout" }, true);

        await flushPromises();

        expect(modal1OnFinished).toHaveBeenCalled();
        expect(modal2OnFinished).toHaveBeenCalled();
    });
});
