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

import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { Room } from "matrix-js-sdk/src/models/room";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { RoomNotificationStateStore } from "../../../src/stores/notifications/RoomNotificationStateStore";
import { stubClient } from "../../test-utils";

describe("RoomNotificationStateStore", () => {
    const ROOM_ID = "!roomId:example.org";

    let room;
    let client;

    beforeEach(() => {
        stubClient();
        client = MatrixClientPeg.get();
        room = new Room(ROOM_ID, client, client.getUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    it("does not use legacy thread notification store", () => {
        client.canSupport.set(Feature.ThreadUnreadNotifications, ServerSupport.Stable);
        expect(RoomNotificationStateStore.instance.getThreadsRoomState(room)).toBeNull();
    });

    it("use legacy thread notification store", () => {
        client.canSupport.set(Feature.ThreadUnreadNotifications, ServerSupport.Unsupported);
        expect(RoomNotificationStateStore.instance.getThreadsRoomState(room)).not.toBeNull();
    });

    it("does not use legacy thread notification store", () => {
        client.canSupport.set(Feature.ThreadUnreadNotifications, ServerSupport.Stable);
        RoomNotificationStateStore.instance.getRoomState(room);
        expect(RoomNotificationStateStore.instance.getThreadsRoomState(room)).toBeNull();
    });

    it("use legacy thread notification store", () => {
        client.canSupport.set(Feature.ThreadUnreadNotifications, ServerSupport.Unsupported);
        RoomNotificationStateStore.instance.getRoomState(room);
        expect(RoomNotificationStateStore.instance.getThreadsRoomState(room)).not.toBeNull();
    });
});
