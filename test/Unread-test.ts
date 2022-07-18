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
import {
    MatrixEvent,
    EventType,
    MsgType,
} from "matrix-js-sdk/src/matrix";

import { haveRendererForEvent } from "../src/events/EventTileFactory";
import { getMockClientWithEventEmitter, makeBeaconEvent, mockClientMethodsUser } from "./test-utils";
import { eventTriggersUnreadCount } from "../src/Unread";

jest.mock("../src/events/EventTileFactory", () => ({
    haveRendererForEvent: jest.fn(),
}));

describe('eventTriggersUnreadCount()', () => {
    const aliceId = '@alice:server.org';
    const bobId = '@bob:server.org';

    // mock user credentials
    getMockClientWithEventEmitter({
        ...mockClientMethodsUser(bobId),
    });

    // setup events
    const alicesMessage = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: aliceId,
        content: {
            msgtype: MsgType.Text,
            body: 'Hello from Alice',
        },
    });

    const bobsMessage = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: bobId,
        content: {
            msgtype: MsgType.Text,
            body: 'Hello from Bob',
        },
    });

    const redactedEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        sender: aliceId,
    });
    redactedEvent.makeRedacted(redactedEvent);

    beforeEach(() => {
        jest.clearAllMocks();
        mocked(haveRendererForEvent).mockClear().mockReturnValue(false);
    });

    it('returns false when the event was sent by the current user', () => {
        expect(eventTriggersUnreadCount(bobsMessage)).toBe(false);
        // returned early before checking renderer
        expect(haveRendererForEvent).not.toHaveBeenCalled();
    });

    it('returns false for a redacted event', () => {
        expect(eventTriggersUnreadCount(redactedEvent)).toBe(false);
        // returned early before checking renderer
        expect(haveRendererForEvent).not.toHaveBeenCalled();
    });

    it('returns false for an event without a renderer', () => {
        mocked(haveRendererForEvent).mockReturnValue(false);
        expect(eventTriggersUnreadCount(alicesMessage)).toBe(false);
        expect(haveRendererForEvent).toHaveBeenCalledWith(alicesMessage, false);
    });

    it('returns true for an event with a renderer', () => {
        mocked(haveRendererForEvent).mockReturnValue(true);
        expect(eventTriggersUnreadCount(alicesMessage)).toBe(true);
        expect(haveRendererForEvent).toHaveBeenCalledWith(alicesMessage, false);
    });

    it('returns false for beacon locations', () => {
        const beaconLocationEvent = makeBeaconEvent(aliceId);
        expect(eventTriggersUnreadCount(beaconLocationEvent)).toBe(false);
        expect(haveRendererForEvent).not.toHaveBeenCalled();
    });

    const noUnreadEventTypes = [
        EventType.RoomMember,
        EventType.RoomThirdPartyInvite,
        EventType.CallAnswer,
        EventType.CallHangup,
        EventType.RoomAliases,
        EventType.RoomCanonicalAlias,
        EventType.RoomServerAcl,
    ];

    it.each(noUnreadEventTypes)('returns false without checking for renderer for events with type %s', (eventType) => {
        const event = new MatrixEvent({
            type: eventType,
            sender: aliceId,
        });
        expect(eventTriggersUnreadCount(event)).toBe(false);
        expect(haveRendererForEvent).not.toHaveBeenCalled();
    });
});
