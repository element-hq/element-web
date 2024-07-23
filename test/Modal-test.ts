/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import Modal from "../src/Modal";
import QuestionDialog from "../src/components/views/dialogs/QuestionDialog";
import defaultDispatcher from "../src/dispatcher/dispatcher";

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
