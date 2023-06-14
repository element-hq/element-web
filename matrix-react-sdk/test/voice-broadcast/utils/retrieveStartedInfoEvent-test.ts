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

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    retrieveStartedInfoEvent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("retrieveStartedInfoEvent", () => {
    let client: MatrixClient;
    let room: Room;

    const mkStartEvent = () => {
        return mkVoiceBroadcastInfoStateEvent(
            room.roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.deviceId!,
        );
    };

    const mkStopEvent = (startEvent: MatrixEvent) => {
        return mkVoiceBroadcastInfoStateEvent(
            room.roomId,
            VoiceBroadcastInfoState.Stopped,
            client.getUserId()!,
            client.deviceId!,
            startEvent,
        );
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room("!room:example.com", client, client.getUserId()!);
        mocked(client.getRoom).mockImplementation((roomId: string): Room | null => {
            if (roomId === room.roomId) return room;
            return null;
        });
    });

    it("when passing a started event, it should return the event", async () => {
        const event = mkStartEvent();
        expect(await retrieveStartedInfoEvent(event, client)).toBe(event);
    });

    it("when passing an event without relation, it should return null", async () => {
        const event = mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            user: client.getUserId()!,
            content: {},
        });
        expect(await retrieveStartedInfoEvent(event, client)).toBeNull();
    });

    it("when the room contains the event, it should return it", async () => {
        const startEvent = mkStartEvent();
        const stopEvent = mkStopEvent(startEvent);
        room.addLiveEvents([startEvent]);
        expect(await retrieveStartedInfoEvent(stopEvent, client)).toBe(startEvent);
    });

    it("when the room not contains the event, it should fetch it", async () => {
        const startEvent = mkStartEvent();
        const stopEvent = mkStopEvent(startEvent);
        mocked(client.fetchRoomEvent).mockResolvedValue(startEvent.event);
        expect((await retrieveStartedInfoEvent(stopEvent, client))?.getId()).toBe(startEvent.getId());
        expect(client.fetchRoomEvent).toHaveBeenCalledWith(room.roomId, startEvent.getId());
    });
});
