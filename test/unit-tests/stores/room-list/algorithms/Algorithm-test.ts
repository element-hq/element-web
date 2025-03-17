/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type MockedObject } from "jest-mock";
import { PendingEventOrdering, Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { Widget } from "matrix-widget-api";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    setupAsyncStoreWithClient,
    useMockedCalls,
    MockedCall,
    useMockMediaDevices,
} from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";
import { SortAlgorithm, ListAlgorithm } from "../../../../../src/stores/room-list/algorithms/models";
import "../../../../../src/stores/room-list/RoomListStore"; // must be imported before Algorithm to avoid cycles
import { Algorithm } from "../../../../../src/stores/room-list/algorithms/Algorithm";
import { CallStore } from "../../../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../../../src/stores/widgets/WidgetMessagingStore";

describe("Algorithm", () => {
    useMockedCalls();

    let client: MockedObject<MatrixClient>;
    let algorithm: Algorithm;

    beforeEach(() => {
        useMockMediaDevices();
        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        DMRoomMap.makeShared(client);

        algorithm = new Algorithm();
        algorithm.start();
        algorithm.populateTags(
            { [DefaultTagID.Untagged]: SortAlgorithm.Alphabetic },
            { [DefaultTagID.Untagged]: ListAlgorithm.Natural },
        );
    });

    afterEach(() => {
        algorithm.stop();
    });

    it("sticks rooms with calls to the top when they're connected", async () => {
        const room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        const roomWithCall = new Room("!2:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        client.getRoom.mockImplementation((roomId) => {
            switch (roomId) {
                case room.roomId:
                    return room;
                case roomWithCall.roomId:
                    return roomWithCall;
                default:
                    return null;
            }
        });
        client.getRooms.mockReturnValue([room, roomWithCall]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);
        client.reEmitter.reEmit(roomWithCall, [RoomStateEvent.Events]);

        for (const room of client.getRooms()) jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        algorithm.setKnownRooms(client.getRooms());

        setupAsyncStoreWithClient(CallStore.instance, client);
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

        MockedCall.create(roomWithCall, "1");
        const call = CallStore.instance.getCall(roomWithCall.roomId);
        if (call === null) throw new Error("Failed to create call");

        const widget = new Widget(call.widget);
        WidgetMessagingStore.instance.storeMessaging(widget, roomWithCall.roomId, {
            stop: () => {},
        } as unknown as ClientWidgetApi);

        // End of setup

        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([room, roomWithCall]);
        await call.start();
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([roomWithCall, room]);
        await call.disconnect();
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([room, roomWithCall]);
    });
});
