/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { mocked, MockedObject } from "jest-mock";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";

import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { ClientWidgetApi } from "matrix-widget-api";
import { stubClient, setupAsyncStoreWithClient, useMockedCalls, MockedCall } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import { SortAlgorithm, ListAlgorithm } from "../../../../src/stores/room-list/algorithms/models";
import "../../../../src/stores/room-list/RoomListStore"; // must be imported before Algorithm to avoid cycles
import { Algorithm } from "../../../../src/stores/room-list/algorithms/Algorithm";
import { CallStore } from "../../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";

describe("Algorithm", () => {
    useMockedCalls();

    let client: MockedObject<MatrixClient>;
    let algorithm: Algorithm;

    beforeEach(() => {
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

        for (const room of client.getRooms()) jest.spyOn(room, "getMyMembership").mockReturnValue("join");
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
        await call.connect();
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([roomWithCall, room]);
        await call.disconnect();
        expect(algorithm.getOrderedRooms()[DefaultTagID.Untagged]).toEqual([room, roomWithCall]);
    });
});
