/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { render, type RenderOptions } from "jest-matrix-react";
import { type MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "events";

import { stubClient } from "../../test-utils";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { SDKContext, SdkContextClass } from "../../../src/contexts/SDKContext";
import { ScopedRoomContextProvider } from "../../../src/contexts/ScopedRoomContext";
import RoomContext, { type RoomContextType } from "../../../src/contexts/RoomContext";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { RoomView } from "../../../src/components/structures/RoomView";
import { ModuleApi } from "../../../src/modules/Api";

describe("ExtrasApi", () => {
    let client: MatrixClient;
    let sdkContext: SdkContextClass;
    let room: Room;
    let roomContext: RoomContextType;

    beforeEach(() => {
        client = stubClient();
        room = new Room("!test:room", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        sdkContext = new SdkContextClass();
        sdkContext.client = client;
        jest.spyOn(sdkContext.roomViewStore, "getRoomId").mockReturnValue(room.roomId);

        const mockRoomViewStore = new (class extends EventEmitter {
            isViewingCall = jest.fn().mockReturnValue(false);
        })();

        roomContext = {
            ...RoomContext,
            roomId: "!test:room",
            roomViewStore: mockRoomViewStore,
        } as unknown as RoomContextType;

        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn(),
            getRoomIds: jest.fn().mockReturnValue(new Set()),
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
        const callback = jest.fn();
        ModuleApi.instance.extras.addRoomHeaderButtonCallback(callback);

        render(<RoomView />, getWrapper());

        act(() => {
            sdkContext.roomViewStore.emit("update");
        });

        expect(callback).toHaveBeenCalled();
    });
});
