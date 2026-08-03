/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LinkedText } from "@element-hq/web-shared-components";
import { screen } from "test-utils-rtl";
import { flushPromises, stubClient } from "test-utils";
import type { I18nApi } from "@element-hq/web-shared-components";

import Modal from "./Modal";
import { type ModuleApi } from "./modules/Api";

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
});
