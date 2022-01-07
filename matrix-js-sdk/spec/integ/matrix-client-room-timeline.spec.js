import * as utils from "../test-utils";
import { EventStatus } from "../../src/models/event";
import { TestClient } from "../TestClient";

describe("MatrixClient room timelines", function() {
    let client = null;
    let httpBackend = null;
    const userId = "@alice:localhost";
    const userName = "Alice";
    const accessToken = "aseukfgwef";
    const roomId = "!foo:bar";
    const otherUserId = "@bob:localhost";
    const USER_MEMBERSHIP_EVENT = utils.mkMembership({
        room: roomId, mship: "join", user: userId, name: userName,
    });
    const ROOM_NAME_EVENT = utils.mkEvent({
        type: "m.room.name", room: roomId, user: otherUserId,
        content: {
            name: "Old room name",
        },
    });
    let NEXT_SYNC_DATA;
    const SYNC_DATA = {
        next_batch: "s_5_3",
        rooms: {
            join: {
                "!foo:bar": { // roomId
                    timeline: {
                        events: [
                            utils.mkMessage({
                                room: roomId, user: otherUserId, msg: "hello",
                            }),
                        ],
                        prev_batch: "f_1_1",
                    },
                    state: {
                        events: [
                            ROOM_NAME_EVENT,
                            utils.mkMembership({
                                room: roomId, mship: "join",
                                user: otherUserId, name: "Bob",
                            }),
                            USER_MEMBERSHIP_EVENT,
                            utils.mkEvent({
                                type: "m.room.create", room: roomId, user: userId,
                                content: {
                                    creator: userId,
                                },
                            }),
                        ],
                    },
                },
            },
        },
    };

    function setNextSyncData(events) {
        events = events || [];
        NEXT_SYNC_DATA = {
            next_batch: "n",
            presence: { events: [] },
            rooms: {
                invite: {},
                join: {
                    "!foo:bar": {
                        timeline: { events: [] },
                        state: { events: [] },
                        ephemeral: { events: [] },
                    },
                },
                leave: {},
            },
        };
        events.forEach(function(e) {
            if (e.room_id !== roomId) {
                throw new Error("setNextSyncData only works with one room id");
            }
            if (e.state_key) {
                if (e.__prev_event === undefined) {
                    throw new Error(
                        "setNextSyncData needs the prev state set to '__prev_event' " +
                        "for " + e.type,
                    );
                }
                if (e.__prev_event !== null) {
                    // push the previous state for this event type
                    NEXT_SYNC_DATA.rooms.join[roomId].state.events.push(e.__prev_event);
                }
                // push the current
                NEXT_SYNC_DATA.rooms.join[roomId].timeline.events.push(e);
            } else if (["m.typing", "m.receipt"].indexOf(e.type) !== -1) {
                NEXT_SYNC_DATA.rooms.join[roomId].ephemeral.events.push(e);
            } else {
                NEXT_SYNC_DATA.rooms.join[roomId].timeline.events.push(e);
            }
        });
    }

    beforeEach(function() {
        // these tests should work with or without timelineSupport
        const testClient = new TestClient(
            userId,
            "DEVICE",
            accessToken,
            undefined,
            { timelineSupport: true },
        );
        httpBackend = testClient.httpBackend;
        client = testClient.client;

        setNextSyncData();
        httpBackend.when("GET", "/pushrules").respond(200, {});
        httpBackend.when("POST", "/filter").respond(200, { filter_id: "fid" });
        httpBackend.when("GET", "/sync").respond(200, SYNC_DATA);
        httpBackend.when("GET", "/sync").respond(200, function() {
            return NEXT_SYNC_DATA;
        });
        client.startClient();
        return httpBackend.flush("/pushrules").then(function() {
            return httpBackend.flush("/filter");
        });
    });

    afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
        client.stopClient();
        return httpBackend.stop();
    });

    describe("local echo events", function() {
        it("should be added immediately after calling MatrixClient.sendEvent " +
        "with EventStatus.SENDING and the right event.sender", function(done) {
            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                expect(room.timeline.length).toEqual(1);

                client.sendTextMessage(roomId, "I am a fish", "txn1");
                // check it was added
                expect(room.timeline.length).toEqual(2);
                // check status
                expect(room.timeline[1].status).toEqual(EventStatus.SENDING);
                // check member
                const member = room.timeline[1].sender;
                expect(member.userId).toEqual(userId);
                expect(member.name).toEqual(userName);

                httpBackend.flush("/sync", 1).then(function() {
                    done();
                });
            });
            httpBackend.flush("/sync", 1);
        });

        it("should be updated correctly when the send request finishes " +
        "BEFORE the event comes down the event stream", function(done) {
            const eventId = "$foo:bar";
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: eventId,
            });

            const ev = utils.mkMessage({
                body: "I am a fish", user: userId, room: roomId,
            });
            ev.event_id = eventId;
            ev.unsigned = { transaction_id: "txn1" };
            setNextSyncData([ev]);

            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                client.sendTextMessage(roomId, "I am a fish", "txn1").then(
                function() {
                    expect(room.timeline[1].getId()).toEqual(eventId);
                    httpBackend.flush("/sync", 1).then(function() {
                        expect(room.timeline[1].getId()).toEqual(eventId);
                        done();
                    });
                });
                httpBackend.flush("/txn1", 1);
            });
            httpBackend.flush("/sync", 1);
        });

        it("should be updated correctly when the send request finishes " +
        "AFTER the event comes down the event stream", function(done) {
            const eventId = "$foo:bar";
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: eventId,
            });

            const ev = utils.mkMessage({
                body: "I am a fish", user: userId, room: roomId,
            });
            ev.event_id = eventId;
            ev.unsigned = { transaction_id: "txn1" };
            setNextSyncData([ev]);

            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                const promise = client.sendTextMessage(roomId, "I am a fish", "txn1");
                httpBackend.flush("/sync", 1).then(function() {
                    expect(room.timeline.length).toEqual(2);
                    httpBackend.flush("/txn1", 1);
                    promise.then(function() {
                        expect(room.timeline.length).toEqual(2);
                        expect(room.timeline[1].getId()).toEqual(eventId);
                        done();
                    });
                });
            });
            httpBackend.flush("/sync", 1);
        });
    });

    describe("paginated events", function() {
        let sbEvents;
        const sbEndTok = "pagin_end";

        beforeEach(function() {
            sbEvents = [];
            httpBackend.when("GET", "/messages").respond(200, function() {
                return {
                    chunk: sbEvents,
                    start: "pagin_start",
                    end: sbEndTok,
                };
            });
        });

        it("should set Room.oldState.paginationToken to null at the start" +
        " of the timeline.", function(done) {
            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                expect(room.timeline.length).toEqual(1);

                client.scrollback(room).then(function() {
                    expect(room.timeline.length).toEqual(1);
                    expect(room.oldState.paginationToken).toBe(null);

                    // still have a sync to flush
                    httpBackend.flush("/sync", 1).then(() => {
                        done();
                    });
                });

                httpBackend.flush("/messages", 1);
            });
            httpBackend.flush("/sync", 1);
        });

        it("should set the right event.sender values", function(done) {
            // We're aiming for an eventual timeline of:
            //
            // 'Old Alice' joined the room
            // <Old Alice> I'm old alice
            // @alice:localhost changed their name from 'Old Alice' to 'Alice'
            // <Alice> I'm alice
            // ------^ /messages results above this point, /sync result below
            // <Bob> hello

            // make an m.room.member event for alice's join
            const joinMshipEvent = utils.mkMembership({
                mship: "join", user: userId, room: roomId, name: "Old Alice",
                url: null,
            });

            // make an m.room.member event with prev_content for alice's nick
            // change
            const oldMshipEvent = utils.mkMembership({
                mship: "join", user: userId, room: roomId, name: userName,
                url: "mxc://some/url",
            });
            oldMshipEvent.prev_content = {
                displayname: "Old Alice",
                avatar_url: null,
                membership: "join",
            };

            // set the list of events to return on scrollback (/messages)
            // N.B. synapse returns /messages in reverse chronological order
            sbEvents = [
                utils.mkMessage({
                    user: userId, room: roomId, msg: "I'm alice",
                }),
                oldMshipEvent,
                utils.mkMessage({
                    user: userId, room: roomId, msg: "I'm old alice",
                }),
                joinMshipEvent,
            ];

            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                // sync response
                expect(room.timeline.length).toEqual(1);

                client.scrollback(room).then(function() {
                    expect(room.timeline.length).toEqual(5);
                    const joinMsg = room.timeline[0];
                    expect(joinMsg.sender.name).toEqual("Old Alice");
                    const oldMsg = room.timeline[1];
                    expect(oldMsg.sender.name).toEqual("Old Alice");
                    const newMsg = room.timeline[3];
                    expect(newMsg.sender.name).toEqual(userName);

                    // still have a sync to flush
                    httpBackend.flush("/sync", 1).then(() => {
                        done();
                    });
                });

                httpBackend.flush("/messages", 1);
            });
            httpBackend.flush("/sync", 1);
        });

        it("should add it them to the right place in the timeline", function(done) {
            // set the list of events to return on scrollback
            sbEvents = [
                utils.mkMessage({
                    user: userId, room: roomId, msg: "I am new",
                }),
                utils.mkMessage({
                    user: userId, room: roomId, msg: "I am old",
                }),
            ];

            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                expect(room.timeline.length).toEqual(1);

                client.scrollback(room).then(function() {
                    expect(room.timeline.length).toEqual(3);
                    expect(room.timeline[0].event).toEqual(sbEvents[1]);
                    expect(room.timeline[1].event).toEqual(sbEvents[0]);

                    // still have a sync to flush
                    httpBackend.flush("/sync", 1).then(() => {
                        done();
                    });
                });

                httpBackend.flush("/messages", 1);
            });
            httpBackend.flush("/sync", 1);
        });

        it("should use 'end' as the next pagination token", function(done) {
            // set the list of events to return on scrollback
            sbEvents = [
                utils.mkMessage({
                    user: userId, room: roomId, msg: "I am new",
                }),
            ];

            client.on("sync", function(state) {
                if (state !== "PREPARED") {
                    return;
                }
                const room = client.getRoom(roomId);
                expect(room.oldState.paginationToken).toBeTruthy();

                client.scrollback(room, 1).then(function() {
                    expect(room.oldState.paginationToken).toEqual(sbEndTok);
                });

                httpBackend.flush("/messages", 1).then(function() {
                    // still have a sync to flush
                    httpBackend.flush("/sync", 1).then(() => {
                        done();
                    });
                });
            });
            httpBackend.flush("/sync", 1);
        });
    });

    describe("new events", function() {
        it("should be added to the right place in the timeline", function() {
            const eventData = [
                utils.mkMessage({ user: userId, room: roomId }),
                utils.mkMessage({ user: userId, room: roomId }),
            ];
            setNextSyncData(eventData);

            return Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]).then(() => {
                const room = client.getRoom(roomId);

                let index = 0;
                client.on("Room.timeline", function(event, rm, toStart) {
                    expect(toStart).toBe(false);
                    expect(rm).toEqual(room);
                    expect(event.event).toEqual(eventData[index]);
                    index += 1;
                });

                httpBackend.flush("/messages", 1);
                return Promise.all([
                    httpBackend.flush("/sync", 1),
                    utils.syncPromise(client),
                ]).then(function() {
                    expect(index).toEqual(2);
                    expect(room.timeline.length).toEqual(3);
                    expect(room.timeline[2].event).toEqual(
                        eventData[1],
                    );
                    expect(room.timeline[1].event).toEqual(
                        eventData[0],
                    );
                });
            });
        });

        it("should set the right event.sender values", function() {
            const eventData = [
                utils.mkMessage({ user: userId, room: roomId }),
                utils.mkMembership({
                    user: userId, room: roomId, mship: "join", name: "New Name",
                }),
                utils.mkMessage({ user: userId, room: roomId }),
            ];
            eventData[1].__prev_event = USER_MEMBERSHIP_EVENT;
            setNextSyncData(eventData);

            return Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]).then(() => {
                const room = client.getRoom(roomId);
                return Promise.all([
                    httpBackend.flush("/sync", 1),
                    utils.syncPromise(client),
                ]).then(function() {
                    const preNameEvent = room.timeline[room.timeline.length - 3];
                    const postNameEvent = room.timeline[room.timeline.length - 1];
                    expect(preNameEvent.sender.name).toEqual(userName);
                    expect(postNameEvent.sender.name).toEqual("New Name");
                });
            });
        });

        it("should set the right room.name", function() {
            const secondRoomNameEvent = utils.mkEvent({
                user: userId, room: roomId, type: "m.room.name", content: {
                    name: "Room 2",
                },
            });
            secondRoomNameEvent.__prev_event = ROOM_NAME_EVENT;
            setNextSyncData([secondRoomNameEvent]);

            return Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]).then(() => {
                const room = client.getRoom(roomId);
                let nameEmitCount = 0;
                client.on("Room.name", function(rm) {
                    nameEmitCount += 1;
                });

                return Promise.all([
                    httpBackend.flush("/sync", 1),
                    utils.syncPromise(client),
                ]).then(function() {
                    expect(nameEmitCount).toEqual(1);
                    expect(room.name).toEqual("Room 2");
                    // do another round
                    const thirdRoomNameEvent = utils.mkEvent({
                        user: userId, room: roomId, type: "m.room.name", content: {
                            name: "Room 3",
                        },
                    });
                    thirdRoomNameEvent.__prev_event = secondRoomNameEvent;
                    setNextSyncData([thirdRoomNameEvent]);
                    httpBackend.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);
                    return Promise.all([
                        httpBackend.flush("/sync", 1),
                        utils.syncPromise(client),
                    ]);
                }).then(function() {
                    expect(nameEmitCount).toEqual(2);
                    expect(room.name).toEqual("Room 3");
                });
            });
        });

        it("should set the right room members", function() {
            const userC = "@cee:bar";
            const userD = "@dee:bar";
            const eventData = [
                utils.mkMembership({
                    user: userC, room: roomId, mship: "join", name: "C",
                }),
                utils.mkMembership({
                    user: userC, room: roomId, mship: "invite", skey: userD,
                }),
            ];
            eventData[0].__prev_event = null;
            eventData[1].__prev_event = null;
            setNextSyncData(eventData);

            return Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]).then(() => {
                const room = client.getRoom(roomId);
                return Promise.all([
                    httpBackend.flush("/sync", 1),
                    utils.syncPromise(client),
                ]).then(function() {
                    expect(room.currentState.getMembers().length).toEqual(4);
                    expect(room.currentState.getMember(userC).name).toEqual("C");
                    expect(room.currentState.getMember(userC).membership).toEqual(
                        "join",
                    );
                    expect(room.currentState.getMember(userD).name).toEqual(userD);
                    expect(room.currentState.getMember(userD).membership).toEqual(
                        "invite",
                    );
                });
            });
        });
    });

    describe("gappy sync", function() {
        it("should copy the last known state to the new timeline", function() {
            const eventData = [
                utils.mkMessage({ user: userId, room: roomId }),
            ];
            setNextSyncData(eventData);
            NEXT_SYNC_DATA.rooms.join[roomId].timeline.limited = true;

            return Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]).then(() => {
                const room = client.getRoom(roomId);

                httpBackend.flush("/messages", 1);
                return Promise.all([
                    httpBackend.flush("/sync", 1),
                    utils.syncPromise(client),
                ]).then(function() {
                    expect(room.timeline.length).toEqual(1);
                    expect(room.timeline[0].event).toEqual(eventData[0]);
                    expect(room.currentState.getMembers().length).toEqual(2);
                    expect(room.currentState.getMember(userId).name).toEqual(userName);
                    expect(room.currentState.getMember(userId).membership).toEqual(
                        "join",
                    );
                    expect(room.currentState.getMember(otherUserId).name).toEqual("Bob");
                    expect(room.currentState.getMember(otherUserId).membership).toEqual(
                        "join",
                    );
                });
            });
        });

        it("should emit a 'Room.timelineReset' event", function() {
            const eventData = [
                utils.mkMessage({ user: userId, room: roomId }),
            ];
            setNextSyncData(eventData);
            NEXT_SYNC_DATA.rooms.join[roomId].timeline.limited = true;

            return Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]).then(() => {
                const room = client.getRoom(roomId);

                let emitCount = 0;
                client.on("Room.timelineReset", function(emitRoom) {
                    expect(emitRoom).toEqual(room);
                    emitCount++;
                });

                httpBackend.flush("/messages", 1);
                return Promise.all([
                    httpBackend.flush("/sync", 1),
                    utils.syncPromise(client),
                ]).then(function() {
                    expect(emitCount).toEqual(1);
                });
            });
        });
    });
});
