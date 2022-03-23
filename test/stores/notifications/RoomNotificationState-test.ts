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

import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEventEvent, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { RoomNotificationState } from "../../../src/stores/notifications/RoomNotificationState";
import * as testUtils from "../../test-utils";
import { NotificationStateEvents } from "../../../src/stores/notifications/NotificationState";

describe("RoomNotificationState", () => {
    stubClient();
    const client = MatrixClientPeg.get();

    it("Updates on event decryption", () => {
        const testRoom = testUtils.mkStubRoom("$aroomid", "Test room", client);

        const roomNotifState = new RoomNotificationState(testRoom as any as Room);
        const listener = jest.fn();
        roomNotifState.addListener(NotificationStateEvents.Update, listener);
        const testEvent = {
            getRoomId: () => testRoom.roomId,
        } as unknown as MatrixEvent;
        testRoom.getUnreadNotificationCount = jest.fn().mockReturnValue(1);
        client.emit(MatrixEventEvent.Decrypted, testEvent);
        expect(listener).toHaveBeenCalled();
    });
});
