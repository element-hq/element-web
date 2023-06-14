/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { MatrixClient } from "../../../../src/client";
import { InRoomChannel } from "../../../../src/crypto/verification/request/InRoomChannel";
import { MatrixEvent } from "../../../../src/models/event";

describe("InRoomChannel tests", function () {
    const ALICE = "@alice:hs.tld";
    const BOB = "@bob:hs.tld";
    const MALORY = "@malory:hs.tld";
    const client = {
        getUserId() {
            return ALICE;
        },
    } as unknown as MatrixClient;

    it("getEventType only returns .request for a message with a msgtype", function () {
        const invalidEvent = new MatrixEvent({
            type: "m.key.verification.request",
        });
        expect(InRoomChannel.getEventType(invalidEvent)).toStrictEqual("");
        const validEvent = new MatrixEvent({
            type: "m.room.message",
            content: { msgtype: "m.key.verification.request" },
        });
        expect(InRoomChannel.getEventType(validEvent)).toStrictEqual("m.key.verification.request");
        const validFooEvent = new MatrixEvent({ type: "m.foo" });
        expect(InRoomChannel.getEventType(validFooEvent)).toStrictEqual("m.foo");
    });

    it("getEventType should return m.room.message for messages", function () {
        const messageEvent = new MatrixEvent({
            type: "m.room.message",
            content: { msgtype: "m.text" },
        });
        // XXX: The event type doesn't matter too much, just as long as it's not a verification event
        expect(InRoomChannel.getEventType(messageEvent)).toStrictEqual("m.room.message");
    });

    it("getEventType should return actual type for non-message events", function () {
        const event = new MatrixEvent({
            type: "m.room.member",
            content: {},
        });
        expect(InRoomChannel.getEventType(event)).toStrictEqual("m.room.member");
    });

    it("getOtherPartyUserId should not return anything for a request not " + "directed at me", function () {
        const event = new MatrixEvent({
            sender: BOB,
            type: "m.room.message",
            content: { msgtype: "m.key.verification.request", to: MALORY },
        });
        expect(InRoomChannel.getOtherPartyUserId(event, client)).toStrictEqual(undefined);
    });

    it("getOtherPartyUserId should not return anything an event that is not of a valid " + "request type", function () {
        // invalid because this should be a room message with msgtype
        const invalidRequest = new MatrixEvent({
            sender: BOB,
            type: "m.key.verification.request",
            content: { to: ALICE },
        });
        expect(InRoomChannel.getOtherPartyUserId(invalidRequest, client)).toStrictEqual(undefined);
        const startEvent = new MatrixEvent({
            sender: BOB,
            type: "m.key.verification.start",
            content: { to: ALICE },
        });
        expect(InRoomChannel.getOtherPartyUserId(startEvent, client)).toStrictEqual(undefined);
        const fooEvent = new MatrixEvent({
            sender: BOB,
            type: "m.foo",
            content: { to: ALICE },
        });
        expect(InRoomChannel.getOtherPartyUserId(fooEvent, client)).toStrictEqual(undefined);
    });
});
