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
import { VerificationRequest, READY_TYPE, START_TYPE, DONE_TYPE } from
    "../../../../src/crypto/verification/request/VerificationRequest";
import { InRoomChannel } from "../../../../src/crypto/verification/request/InRoomChannel";
import { ToDeviceChannel } from
    "../../../../src/crypto/verification/request/ToDeviceChannel";
import { MatrixEvent } from "../../../../src/models/event";
import { setupWebcrypto, teardownWebcrypto } from "./util";

function makeMockClient(userId, deviceId) {
    let counter = 1;
    let events = [];
    const deviceEvents = {};
    return {
        getUserId() { return userId; },
        getDeviceId() { return deviceId; },

        sendEvent(roomId, type, content) {
            counter = counter + 1;
            const eventId = `$${userId}-${deviceId}-${counter}`;
            events.push(new MatrixEvent({
                sender: userId,
                event_id: eventId,
                room_id: roomId,
                type,
                content,
                origin_server_ts: Date.now(),
            }));
            return Promise.resolve({ event_id: eventId });
        },

        sendToDevice(type, msgMap) {
            for (const userId of Object.keys(msgMap)) {
                const deviceMap = msgMap[userId];
                for (const deviceId of Object.keys(deviceMap)) {
                    const content = deviceMap[deviceId];
                    const event = new MatrixEvent({ content, type });
                    deviceEvents[userId] = deviceEvents[userId] || {};
                    deviceEvents[userId][deviceId] = deviceEvents[userId][deviceId] || [];
                    deviceEvents[userId][deviceId].push(event);
                }
            }
            return Promise.resolve();
        },

        popEvents() {
            const e = events;
            events = [];
            return e;
        },

        popDeviceEvents(userId, deviceId) {
            const forDevice = deviceEvents[userId];
            const events = forDevice && forDevice[deviceId];
            const result = events || [];
            if (events) {
                delete forDevice[deviceId];
            }
            return result;
        },
    };
}

const MOCK_METHOD = "mock-verify";
class MockVerifier {
    constructor(channel, client, userId, deviceId, startEvent) {
        this._channel = channel;
        this._startEvent = startEvent;
    }

    get events() {
        return [DONE_TYPE];
    }

    async start() {
        if (this._startEvent) {
            await this._channel.send(DONE_TYPE, {});
        } else {
            await this._channel.send(START_TYPE, { method: MOCK_METHOD });
        }
    }

    async handleEvent(event) {
        if (event.getType() === DONE_TYPE && !this._startEvent) {
            await this._channel.send(DONE_TYPE, {});
        }
    }

    canSwitchStartEvent() {
        return false;
    }
}

function makeRemoteEcho(event) {
    return new MatrixEvent(Object.assign({}, event.event, {
        unsigned: {
            transaction_id: "abc",
        },
    }));
}

async function distributeEvent(ownRequest, theirRequest, event) {
    await ownRequest.channel.handleEvent(
            makeRemoteEcho(event), ownRequest, true);
    await theirRequest.channel.handleEvent(event, theirRequest, true);
}

jest.useFakeTimers();

describe("verification request unit tests", function() {
    beforeAll(function() {
        setupWebcrypto();
    });

    afterAll(() => {
        teardownWebcrypto();
    });

    it("transition from UNSENT to DONE through happy path", async function() {
        const alice = makeMockClient("@alice:matrix.tld", "device1");
        const bob = makeMockClient("@bob:matrix.tld", "device1");
        const aliceRequest = new VerificationRequest(
            new InRoomChannel(alice, "!room", bob.getUserId()),
            new Map([[MOCK_METHOD, MockVerifier]]), alice);
        const bobRequest = new VerificationRequest(
            new InRoomChannel(bob, "!room"),
            new Map([[MOCK_METHOD, MockVerifier]]), bob);
        expect(aliceRequest.invalid).toBe(true);
        expect(bobRequest.invalid).toBe(true);

        await aliceRequest.sendRequest();
        const [requestEvent] = alice.popEvents();
        expect(requestEvent.getType()).toBe("m.room.message");
        await distributeEvent(aliceRequest, bobRequest, requestEvent);
        expect(aliceRequest.requested).toBe(true);
        expect(bobRequest.requested).toBe(true);

        await bobRequest.accept();
        const [readyEvent] = bob.popEvents();
        expect(readyEvent.getType()).toBe(READY_TYPE);
        await distributeEvent(bobRequest, aliceRequest, readyEvent);
        expect(bobRequest.ready).toBe(true);
        expect(aliceRequest.ready).toBe(true);

        const verifier = aliceRequest.beginKeyVerification(MOCK_METHOD);
        await verifier.start();
        const [startEvent] = alice.popEvents();
        expect(startEvent.getType()).toBe(START_TYPE);
        await distributeEvent(aliceRequest, bobRequest, startEvent);
        expect(aliceRequest.started).toBe(true);
        expect(aliceRequest.verifier).toBeInstanceOf(MockVerifier);
        expect(bobRequest.started).toBe(true);
        expect(bobRequest.verifier).toBeInstanceOf(MockVerifier);

        await bobRequest.verifier.start();
        const [bobDoneEvent] = bob.popEvents();
        expect(bobDoneEvent.getType()).toBe(DONE_TYPE);
        await distributeEvent(bobRequest, aliceRequest, bobDoneEvent);
        const [aliceDoneEvent] = alice.popEvents();
        expect(aliceDoneEvent.getType()).toBe(DONE_TYPE);
        await distributeEvent(aliceRequest, bobRequest, aliceDoneEvent);
        expect(aliceRequest.done).toBe(true);
        expect(bobRequest.done).toBe(true);
    });

    it("methods only contains common methods", async function() {
        const alice = makeMockClient("@alice:matrix.tld", "device1");
        const bob = makeMockClient("@bob:matrix.tld", "device1");
        const aliceRequest = new VerificationRequest(
            new InRoomChannel(alice, "!room", bob.getUserId()),
            new Map([["c", function() {}], ["a", function() {}]]), alice);
        const bobRequest = new VerificationRequest(
            new InRoomChannel(bob, "!room"),
            new Map([["c", function() {}], ["b", function() {}]]), bob);
        await aliceRequest.sendRequest();
        const [requestEvent] = alice.popEvents();
        await distributeEvent(aliceRequest, bobRequest, requestEvent);
        await bobRequest.accept();
        const [readyEvent] = bob.popEvents();
        await distributeEvent(bobRequest, aliceRequest, readyEvent);
        expect(aliceRequest.methods).toStrictEqual(["c"]);
        expect(bobRequest.methods).toStrictEqual(["c"]);
    });

    it("other client accepting request puts it in observeOnly mode", async function() {
        const alice = makeMockClient("@alice:matrix.tld", "device1");
        const bob1 = makeMockClient("@bob:matrix.tld", "device1");
        const bob2 = makeMockClient("@bob:matrix.tld", "device2");
        const aliceRequest = new VerificationRequest(
            new InRoomChannel(alice, "!room", bob1.getUserId()), new Map(), alice);
        await aliceRequest.sendRequest();
        const [requestEvent] = alice.popEvents();
        const bob1Request = new VerificationRequest(
            new InRoomChannel(bob1, "!room"), new Map(), bob1);
        const bob2Request = new VerificationRequest(
            new InRoomChannel(bob2, "!room"), new Map(), bob2);

        await bob1Request.channel.handleEvent(requestEvent, bob1Request, true);
        await bob2Request.channel.handleEvent(requestEvent, bob2Request, true);

        await bob1Request.accept();
        const [readyEvent] = bob1.popEvents();
        expect(bob2Request.observeOnly).toBe(false);
        await bob2Request.channel.handleEvent(readyEvent, bob2Request, true);
        expect(bob2Request.observeOnly).toBe(true);
    });

    it("verify own device with to_device messages", async function() {
        const bob1 = makeMockClient("@bob:matrix.tld", "device1");
        const bob2 = makeMockClient("@bob:matrix.tld", "device2");
        const bob1Request = new VerificationRequest(
            new ToDeviceChannel(bob1, bob1.getUserId(), ["device1", "device2"],
                ToDeviceChannel.makeTransactionId(), "device2"),
            new Map([[MOCK_METHOD, MockVerifier]]), bob1);
        const to = { userId: "@bob:matrix.tld", deviceId: "device2" };
        const verifier = bob1Request.beginKeyVerification(MOCK_METHOD, to);
        expect(verifier).toBeInstanceOf(MockVerifier);
        await verifier.start();
        const [startEvent] = bob1.popDeviceEvents(to.userId, to.deviceId);
        expect(startEvent.getType()).toBe(START_TYPE);
        const bob2Request = new VerificationRequest(
            new ToDeviceChannel(bob2, bob2.getUserId(), ["device1"]),
            new Map([[MOCK_METHOD, MockVerifier]]), bob2);

        await bob2Request.channel.handleEvent(startEvent, bob2Request, true);
        await bob2Request.verifier.start();
        const [doneEvent1] = bob2.popDeviceEvents("@bob:matrix.tld", "device1");
        expect(doneEvent1.getType()).toBe(DONE_TYPE);
        await bob1Request.channel.handleEvent(doneEvent1, bob1Request, true);
        const [doneEvent2] = bob1.popDeviceEvents("@bob:matrix.tld", "device2");
        expect(doneEvent2.getType()).toBe(DONE_TYPE);
        await bob2Request.channel.handleEvent(doneEvent2, bob2Request, true);

        expect(bob1Request.done).toBe(true);
        expect(bob2Request.done).toBe(true);
    });

    it("request times out after 10 minutes", async function() {
        const alice = makeMockClient("@alice:matrix.tld", "device1");
        const bob = makeMockClient("@bob:matrix.tld", "device1");
        const aliceRequest = new VerificationRequest(
            new InRoomChannel(alice, "!room", bob.getUserId()), new Map(), alice);
        await aliceRequest.sendRequest();
        const [requestEvent] = alice.popEvents();
        await aliceRequest.channel.handleEvent(requestEvent, aliceRequest, true,
            true, true);

        expect(aliceRequest.cancelled).toBe(false);
        expect(aliceRequest._cancellingUserId).toBe(undefined);
        jest.advanceTimersByTime(10 * 60 * 1000);
        expect(aliceRequest._cancellingUserId).toBe(alice.getUserId());
    });

    it("request times out 2 minutes after receipt", async function() {
        const alice = makeMockClient("@alice:matrix.tld", "device1");
        const bob = makeMockClient("@bob:matrix.tld", "device1");
        const aliceRequest = new VerificationRequest(
            new InRoomChannel(alice, "!room", bob.getUserId()), new Map(), alice);
        await aliceRequest.sendRequest();
        const [requestEvent] = alice.popEvents();
        const bobRequest = new VerificationRequest(
            new InRoomChannel(bob, "!room"), new Map(), bob);

        await bobRequest.channel.handleEvent(requestEvent, bobRequest, true);

        expect(bobRequest.cancelled).toBe(false);
        expect(bobRequest._cancellingUserId).toBe(undefined);
        jest.advanceTimersByTime(2 * 60 * 1000);
        expect(bobRequest._cancellingUserId).toBe(bob.getUserId());
    });
});
