/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "test-utils-rtl";
import { test, describe, beforeEach, expect, vi, afterEach } from "vitest";

import { MessageComposerUrlPreviewWrapper, DEBOUNCE_REQUEST_TIMEOUT_MS } from "./MessageComposerUrlPreview";
import {
    getMockClientWithEventEmitter,
    getRoomContext,
    mkRoom,
    mockClientMethodsUser,
} from "../../../../test/test-utils";
import type { I18nApi } from "@element-hq/element-web-module-api";
import type { ModuleApi } from "../../../modules/Api";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { CustomComponentsApi } from "../../../modules/customComponentApi";

// @vitest-environment happy-dom

const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

describe("MessageComposerUrlPreview", () => {
    let client: MatrixClient;
    let originalMxModuleApi: ModuleApi;
    beforeEach(() => {
        originalMxModuleApi = window.mxModuleApi;
        window.mxModuleApi = {
            i18n: {} as I18nApi,
        } as ModuleApi;
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            getUrlPreview: vi.fn().mockResolvedValue(BASIC_PREVIEW_OGDATA),
        });
    });
    afterEach(() => {
        window.mxModuleApi = originalMxModuleApi;
    });

    function wrapComponent(component: Parameters<typeof render>[0]): ReturnType<typeof render> {
        return render(component, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider
                        roomId="!foo:bar"
                        {...getRoomContext(mkRoom(client, "!foo:bar"), { showUrlPreview: true })}
                    >
                        {children}
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>
            ),
        });
    }

    test("to be empty without a link to preview", () => {
        const { container } = wrapComponent(<MessageComposerUrlPreviewWrapper content="Test a string" />);
        expect(container).toMatchInlineSnapshot(`<div />`);
    });
    test("to contain a link when there is a URL", async () => {
        const { getByText } = wrapComponent(<MessageComposerUrlPreviewWrapper content="https://example.org" />);
        await waitFor(
            () => {
                expect(getByText("Example.org")).toBeDefined();
            },
            { timeout: DEBOUNCE_REQUEST_TIMEOUT_MS },
        );
    });
    test("to allow overriding with a module component", async () => {
        const modApi = {
            customComponents: new CustomComponentsApi(),
        } as ModuleApi;
        modApi.customComponents.registerComposerPreview(
            () => true,
            () => <strong>Fake preview</strong>,
        );
        const { getByText } = wrapComponent(
            <MessageComposerUrlPreviewWrapper content="https://example.org" moduleApi={modApi} />,
        );
        await waitFor(
            () => {
                expect(getByText("Fake preview")).toBeDefined();
            },
            { timeout: DEBOUNCE_REQUEST_TIMEOUT_MS },
        );
    });
    test("to reset module component override when filter function does not match", async () => {
        const modApi = {
            customComponents: new CustomComponentsApi(),
        } as ModuleApi;
        modApi.customComponents.registerComposerPreview(
            (text) => text === "show-fake-preview",
            () => <strong>Fake preview</strong>,
        );
        const { container, getByText, queryByText, rerender } = wrapComponent(
            <MessageComposerUrlPreviewWrapper content="show-fake-preview" moduleApi={modApi} />,
        );
        await waitFor(() => {
            expect(getByText("Fake preview")).toBeDefined();
        });
        rerender(<MessageComposerUrlPreviewWrapper content="other-text" moduleApi={modApi} />);
        await waitFor(() => {
            expect(queryByText("Fake preview")).toBeNull();
        });
        expect(container).toMatchInlineSnapshot(`<div />`);
    });
});
