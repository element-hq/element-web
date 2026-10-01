/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { act } from "react";
import { render, type RenderOptions } from "test-utils-rtl";
import { type MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "node:events";
import { stubClient, TestSDKContext } from "test-utils";

import DMRoomMap from "../utils/DMRoomMap";
import { SDKContext } from "../contexts/SDKContext";
import { ScopedRoomContextProvider } from "../contexts/ScopedRoomContext";
import RoomContext, { type RoomContextType } from "../contexts/RoomContext";
import MatrixClientContext from "../contexts/MatrixClientContext";
import { RoomView } from "../components/structures/RoomView";
import { ModuleApi } from "./Api";

describe("ExtrasApi", () => {
    let client: MatrixClient;
    let sdkContext: TestSDKContext;
    let room: Room;
    let roomContext: RoomContextType;

    beforeEach(() => {
        client = stubClient();
        room = new Room("!test:room", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        vi.spyOn(sdkContext.roomViewStore, "getRoomId").mockReturnValue(room.roomId);

        const mockRoomViewStore = new (class extends EventEmitter {
            isViewingCall = vi.fn().mockReturnValue(false);
        })();

        roomContext = {
            ...RoomContext,
            roomId: "!test:room",
            roomViewStore: mockRoomViewStore,
        } as unknown as RoomContextType;

        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn(),
            getRoomIds: vi.fn().mockReturnValue(new Set()),
        } as unknown as DMRoomMap);
    });

    function getWrapper(): RenderOptions {
        return {
            wrapper: ({ children }) => (
                <SDKContext.Provider value={sdkContext}>
                    <ScopedRoomContextProvider {...roomContext}>
                        <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
                    </ScopedRoomContextProvider>
                </SDKContext.Provider>
            ),
        };
    }

    it("addRoomHeaderButtonCallback stores and uses the provided callback", () => {
        const callback = vi.fn();
        ModuleApi.instance.extras.addRoomHeaderButtonCallback(callback);

        render(<RoomView />, getWrapper());

        act(() => {
            sdkContext.roomViewStore.emit("update");
        });

        expect(callback).toHaveBeenCalled();
    });
});
