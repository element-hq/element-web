/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LinkedText } from "@element-hq/web-shared-components";
import { screen } from "test-utils-rtl";
import { flushPromises, stubClient } from "test-utils";
import type { I18nApi } from "@element-hq/web-shared-components";

import Modal from "./Modal";
import { type ModuleApi } from "./modules/Api";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import defaultDispatcher from "./dispatcher/dispatcher";

function LinkedTextDialog({ onFinished }: { onFinished(): void }): React.JSX.Element {
    return <LinkedText>Check out https://matrix.org for more info</LinkedText>;
}

describe("Modal", () => {
    let originalMxModuleApi: ModuleApi;

    beforeEach(() => {
        stubClient();
        // Required for the i18n context around the dialog to work.
        originalMxModuleApi = window.mxModuleApi;
        window.mxModuleApi = { i18n: {} as I18nApi } as ModuleApi;
    });

    afterEach(() => {
        Modal.forceCloseAllModals();
        window.mxModuleApi = originalMxModuleApi;
    });

    it("provides LinkedTextContext to dialogs rendered in the separate dialog root", async () => {
        Modal.createDialog(LinkedTextDialog);
        await flushPromises();
        expect(screen.getByRole("link")).toBeInTheDocument();
    });

    it("forceCloseAllModals should close all open modals", () => {
        Modal.createDialog(QuestionDialog, {
            title: "Test dialog",
            description: "This is a test dialog",
            button: "Word",
        });

        expect(Modal.hasDialogs()).toBe(true);
        Modal.forceCloseAllModals();
        expect(Modal.hasDialogs()).toBe(false);
    });

    it("open modals should be closed on logout", async () => {
        const modal1OnFinished = vi.fn();
        const modal2OnFinished = vi.fn();

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
