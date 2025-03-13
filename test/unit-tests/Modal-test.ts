/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import Modal from "../../src/Modal";
import QuestionDialog from "../../src/components/views/dialogs/QuestionDialog";
import defaultDispatcher from "../../src/dispatcher/dispatcher";

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

    test("open modals should be closed on logout", () => {
        const modal1OnFinished = jest.fn();
        const modal2OnFinished = jest.fn();

        Modal.createDialog(QuestionDialog, {
            title: "Test dialog 1",
            description: "This is a test dialog",
            button: "Word",
            onFinished: modal1OnFinished,
        });

        Modal.createDialog(QuestionDialog, {
            title: "Test dialog 2",
            description: "This is a test dialog",
            button: "Word",
            onFinished: modal2OnFinished,
        });

        defaultDispatcher.dispatch({ action: "logout" }, true);

        expect(modal1OnFinished).toHaveBeenCalled();
        expect(modal2OnFinished).toHaveBeenCalled();
    });
});
