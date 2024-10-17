/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

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
