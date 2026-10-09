/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "test-utils-rtl";
import { type Room, TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import {
    enableCalls,
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
    clientAndSDKContextRenderOptions,
    TestSDKContext,
} from "test-utils";

import { ElementCall } from "../../../models/Call";
import { CallStore } from "../../../stores/CallStore";
import { type DocumentPipStore, DocumentPipStoreEvent } from "../../../stores/DocumentPipStore";
import { WrappedElementCallComponent } from "./WrappedElementCallComponent";

// `enableCalls` turns on the mock component, which the wrapper loads from this module. Stand in for
// it: the test only cares what the wrapper hands the component.
vi.mock("./ElementCallMock", () => ({
    initializeElementCall: vi.fn().mockResolvedValue(undefined),
    ElementCall: ({ portalRoot }: { portalRoot?: HTMLElement | null }) => (
        <div data-testid="element-call" data-portal-root={portalRoot?.id ?? "none"} />
    ),
}));

enableCalls();

describe("WrappedElementCallComponent", () => {
    let client: ReturnType<typeof setUpClientRoomAndStores>["client"];
    let room: Room;
    let call: ElementCall;
    let documentPipStore: DocumentPipStore & { isShowing: ReturnType<typeof vi.fn>; pipWindow: Window | null };

    beforeEach(() => {
        ({ client, room } = setUpClientRoomAndStores());
        setupAsyncStoreWithClient(CallStore.instance, client);
        ElementCall.create(room);
        const maybeCall = CallStore.instance.getCall(room.roomId);
        if (!(maybeCall instanceof ElementCall)) throw new Error("Failed to create call");
        call = maybeCall;

        documentPipStore = Object.assign(new TypedEventEmitter(), {
            isShowing: vi.fn().mockReturnValue(false),
            pipWindow: null,
        }) as unknown as typeof documentPipStore;
    });

    afterEach(() => {
        cleanup();
        call.destroy();
        cleanUpClientRoomAndStores(client, room);
        vi.clearAllMocks();
    });

    const renderWrapped = async (): Promise<HTMLElement> => {
        const sdkContext = new TestSDKContext();
        sdkContext._DocumentPipStore = documentPipStore;
        render(<WrappedElementCallComponent call={call} />, clientAndSDKContextRenderOptions(client, sdkContext));
        return await screen.findByTestId("element-call");
    };

    it("leaves the component's floating parts in this document while the call is here", async () => {
        const elementCall = await renderWrapped();
        expect(elementCall).toHaveAttribute("data-portal-root", "none");
    });

    it("sends the component's floating parts into the Picture-in-Picture window with the call", async () => {
        const pipBody = document.createElement("body");
        pipBody.id = "pip-body";
        const elementCall = await renderWrapped();

        documentPipStore.isShowing.mockImplementation((c) => c === call);
        documentPipStore.pipWindow = { document: { body: pipBody } } as unknown as Window;
        act(() => documentPipStore.emit(DocumentPipStoreEvent.Update));
        expect(elementCall).toHaveAttribute("data-portal-root", "pip-body");

        // Back again once the window closes
        documentPipStore.isShowing.mockReturnValue(false);
        documentPipStore.pipWindow = null;
        act(() => documentPipStore.emit(DocumentPipStoreEvent.Update));
        expect(elementCall).toHaveAttribute("data-portal-root", "none");
    });
});
