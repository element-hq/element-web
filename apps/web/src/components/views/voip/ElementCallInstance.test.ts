/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type Room } from "matrix-js-sdk/src/matrix";
import {
    enableCalls,
    setUpClientRoomAndStores,
    cleanUpClientRoomAndStores,
    setupAsyncStoreWithClient,
} from "test-utils";

import { ElementCall } from "../../../models/Call";
import { CallStore } from "../../../stores/CallStore";
import { ElementWebHostBridge } from "./ElementWebHostBridge";
import { ElementCallInstance } from "./ElementCallInstance";

const { enabledSettings } = enableCalls();
enabledSettings.add("feature_element_call_react");

describe("ElementCallInstance", () => {
    let client: ReturnType<typeof setUpClientRoomAndStores>["client"];
    let room: Room;
    let call: ElementCall;

    beforeEach(() => {
        ({ client, room } = setUpClientRoomAndStores());
        setupAsyncStoreWithClient(CallStore.instance, client);
        ElementCall.create(room);
        const maybeCall = CallStore.instance.getCall(room.roomId);
        if (!(maybeCall instanceof ElementCall)) throw new Error("Failed to create call");
        call = maybeCall;
    });

    afterEach(() => {
        ElementCallInstance.destroy(call);
        call.destroy();
        cleanUpClientRoomAndStores(client, room);
        vi.restoreAllMocks();
    });

    /** The props the instance fixed for the component, read off the element it built. */
    const componentProps = (instance: ElementCallInstance): Record<string, unknown> =>
        (instance.element.props as { children: [{ props: Record<string, unknown> }] }).children[0].props;

    it("is created once per call, with a started bridge and one element", () => {
        const start = vi.spyOn(ElementWebHostBridge.prototype, "start");
        const instance = ElementCallInstance.get(call, client);
        expect(start).toHaveBeenCalledTimes(1);

        expect(ElementCallInstance.get(call, client)).toBe(instance);
        expect(ElementCallInstance.get(call, client).element).toBe(instance.element);
        expect(start).toHaveBeenCalledTimes(1);

        expect(componentProps(instance)).toMatchObject({
            client,
            roomId: room.roomId,
            hostBridge: instance.bridge,
        });
    });

    it("fixes the call's intent and configuration when it is created", () => {
        call.widgetGenerationParameters = { skipLobby: true };
        const instance = ElementCallInstance.get(call, client);
        const { intent, config } = componentProps(instance) as { intent: string; config: Record<string, unknown> };
        expect(intent).toBe("start_call");
        expect(config).toMatchObject({ skipLobby: true });

        // Later changes to what the options are computed from do not reach the running component
        call.widgetGenerationParameters = { skipLobby: false };
        expect(componentProps(ElementCallInstance.get(call, client)).config).toBe(config);
    });

    it("stops the bridge when destroyed, and starts afresh afterwards", () => {
        const stop = vi.spyOn(ElementWebHostBridge.prototype, "stop");
        const instance = ElementCallInstance.get(call, client);

        ElementCallInstance.destroy(call);
        expect(stop).toHaveBeenCalledTimes(1);
        ElementCallInstance.destroy(call); // idempotent
        expect(stop).toHaveBeenCalledTimes(1);

        const fresh = ElementCallInstance.get(call, client);
        expect(fresh).not.toBe(instance);
        expect(fresh.bridge).not.toBe(instance.bridge);
    });

    it("is destroyed along with the call model", () => {
        const stop = vi.spyOn(ElementWebHostBridge.prototype, "stop");
        const instance = ElementCallInstance.get(call, client);
        call.destroy();
        expect(stop).toHaveBeenCalledTimes(1);
        expect(ElementCallInstance.get(call, client)).not.toBe(instance);
    });
});
