import * as utils from "../test-utils";
import { TestClient } from "../TestClient";

describe("MatrixClient events", function() {
    let client;
    let httpBackend;
    const selfUserId = "@alice:localhost";
    const selfAccessToken = "aseukfgwef";

    beforeEach(function() {
        const testClient = new TestClient(selfUserId, "DEVICE", selfAccessToken);
        client = testClient.client;
        httpBackend = testClient.httpBackend;
        httpBackend.when("GET", "/pushrules").respond(200, {});
        httpBackend.when("POST", "/filter").respond(200, { filter_id: "a filter id" });
    });

    afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
        client.stopClient();
        return httpBackend.stop();
    });

    describe("emissions", function() {
        const SYNC_DATA = {
            next_batch: "s_5_3",
            presence: {
                events: [
                    utils.mkPresence({
                        user: "@foo:bar", name: "Foo Bar", presence: "online",
                    }),
                ],
            },
            rooms: {
                join: {
                    "!erufh:bar": {
                        timeline: {
                            events: [
                                utils.mkMessage({
                                    room: "!erufh:bar", user: "@foo:bar", msg: "hmmm",
                                }),
                            ],
                            prev_batch: "s",
                        },
                        state: {
                            events: [
                                utils.mkMembership({
                                    room: "!erufh:bar", mship: "join", user: "@foo:bar",
                                }),
                                utils.mkEvent({
                                    type: "m.room.create", room: "!erufh:bar",
                                    user: "@foo:bar",
                                    content: {
                                        creator: "@foo:bar",
                                    },
                                }),
                            ],
                        },
                    },
                },
            },
        };
        const NEXT_SYNC_DATA = {
            next_batch: "e_6_7",
            rooms: {
                join: {
                    "!erufh:bar": {
                        timeline: {
                            events: [
                                utils.mkMessage({
                                    room: "!erufh:bar", user: "@foo:bar",
                                    msg: "ello ello",
                                }),
                                utils.mkMessage({
                                    room: "!erufh:bar", user: "@foo:bar", msg: ":D",
                                }),
                            ],
                        },
                        ephemeral: {
                            events: [
                                utils.mkEvent({
                                    type: "m.typing", room: "!erufh:bar", content: {
                                        user_ids: ["@foo:bar"],
                                    },
                                }),
                            ],
                        },
                    },
                },
            },
        };

        it("should emit events from both the first and subsequent /sync calls",
        function() {
            httpBackend.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);

            let expectedEvents = [];
            expectedEvents = expectedEvents.concat(
                SYNC_DATA.presence.events,
                SYNC_DATA.rooms.join["!erufh:bar"].timeline.events,
                SYNC_DATA.rooms.join["!erufh:bar"].state.events,
                NEXT_SYNC_DATA.rooms.join["!erufh:bar"].timeline.events,
                NEXT_SYNC_DATA.rooms.join["!erufh:bar"].ephemeral.events,
            );

            client.on("event", function(event) {
                let found = false;
                for (let i = 0; i < expectedEvents.length; i++) {
                    if (expectedEvents[i].event_id === event.getId()) {
                        expectedEvents.splice(i, 1);
                        found = true;
                        break;
                    }
                }
                expect(found).toBe(
                    true, "Unexpected 'event' emitted: " + event.getType(),
                );
            });

            client.startClient();

            return Promise.all([
                // wait for two SYNCING events
                utils.syncPromise(client).then(() => {
                    return utils.syncPromise(client);
                }),
                httpBackend.flushAllExpected(),
            ]).then(() => {
                expect(expectedEvents.length).toEqual(
                    0, "Failed to see all events from /sync calls",
                );
            });
        });

        it("should emit User events", function(done) {
            httpBackend.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);
            let fired = false;
            client.on("User.presence", function(event, user) {
                fired = true;
                expect(user).toBeTruthy();
                expect(event).toBeTruthy();
                if (!user || !event) {
                    return;
                }

                expect(event.event).toMatch(SYNC_DATA.presence.events[0]);
                expect(user.presence).toEqual(
                    SYNC_DATA.presence.events[0].content.presence,
                );
            });
            client.startClient();

            httpBackend.flushAllExpected().then(function() {
                expect(fired).toBe(true, "User.presence didn't fire.");
                done();
            });
        });

        it("should emit Room events", function() {
            httpBackend.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);
            let roomInvokeCount = 0;
            let roomNameInvokeCount = 0;
            let timelineFireCount = 0;
            client.on("Room", function(room) {
                roomInvokeCount++;
                expect(room.roomId).toEqual("!erufh:bar");
            });
            client.on("Room.timeline", function(event, room) {
                timelineFireCount++;
                expect(room.roomId).toEqual("!erufh:bar");
            });
            client.on("Room.name", function(room) {
                roomNameInvokeCount++;
            });

            client.startClient();

            return Promise.all([
                httpBackend.flushAllExpected(),
                utils.syncPromise(client, 2),
            ]).then(function() {
                expect(roomInvokeCount).toEqual(
                    1, "Room fired wrong number of times.",
                );
                expect(roomNameInvokeCount).toEqual(
                    1, "Room.name fired wrong number of times.",
                );
                expect(timelineFireCount).toEqual(
                    3, "Room.timeline fired the wrong number of times",
                );
            });
        });

        it("should emit RoomState events", function() {
            httpBackend.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);

            const roomStateEventTypes = [
                "m.room.member", "m.room.create",
            ];
            let eventsInvokeCount = 0;
            let membersInvokeCount = 0;
            let newMemberInvokeCount = 0;
            client.on("RoomState.events", function(event, state) {
                eventsInvokeCount++;
                const index = roomStateEventTypes.indexOf(event.getType());
                expect(index).not.toEqual(
                    -1, "Unexpected room state event type: " + event.getType(),
                );
                if (index >= 0) {
                    roomStateEventTypes.splice(index, 1);
                }
            });
            client.on("RoomState.members", function(event, state, member) {
                membersInvokeCount++;
                expect(member.roomId).toEqual("!erufh:bar");
                expect(member.userId).toEqual("@foo:bar");
                expect(member.membership).toEqual("join");
            });
            client.on("RoomState.newMember", function(event, state, member) {
                newMemberInvokeCount++;
                expect(member.roomId).toEqual("!erufh:bar");
                expect(member.userId).toEqual("@foo:bar");
                expect(member.membership).toBeFalsy();
            });

            client.startClient();

            return Promise.all([
                httpBackend.flushAllExpected(),
                utils.syncPromise(client, 2),
            ]).then(function() {
                expect(membersInvokeCount).toEqual(
                    1, "RoomState.members fired wrong number of times",
                );
                expect(newMemberInvokeCount).toEqual(
                    1, "RoomState.newMember fired wrong number of times",
                );
                expect(eventsInvokeCount).toEqual(
                    2, "RoomState.events fired wrong number of times",
                );
            });
        });

        it("should emit RoomMember events", function() {
            httpBackend.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);

            let typingInvokeCount = 0;
            let powerLevelInvokeCount = 0;
            let nameInvokeCount = 0;
            let membershipInvokeCount = 0;
            client.on("RoomMember.name", function(event, member) {
                nameInvokeCount++;
            });
            client.on("RoomMember.typing", function(event, member) {
                typingInvokeCount++;
                expect(member.typing).toBe(true);
            });
            client.on("RoomMember.powerLevel", function(event, member) {
                powerLevelInvokeCount++;
            });
            client.on("RoomMember.membership", function(event, member) {
                membershipInvokeCount++;
                expect(member.membership).toEqual("join");
            });

            client.startClient();

            return Promise.all([
                httpBackend.flushAllExpected(),
                utils.syncPromise(client, 2),
            ]).then(function() {
                expect(typingInvokeCount).toEqual(
                    1, "RoomMember.typing fired wrong number of times",
                );
                expect(powerLevelInvokeCount).toEqual(
                    0, "RoomMember.powerLevel fired wrong number of times",
                );
                expect(nameInvokeCount).toEqual(
                    0, "RoomMember.name fired wrong number of times",
                );
                expect(membershipInvokeCount).toEqual(
                    1, "RoomMember.membership fired wrong number of times",
                );
            });
        });

        it("should emit Session.logged_out on M_UNKNOWN_TOKEN", function() {
            const error = { errcode: 'M_UNKNOWN_TOKEN' };
            httpBackend.when("GET", "/sync").respond(401, error);

            let sessionLoggedOutCount = 0;
            client.on("Session.logged_out", function(errObj) {
                sessionLoggedOutCount++;
                expect(errObj.data).toEqual(error);
            });

            client.startClient();

            return httpBackend.flushAllExpected().then(function() {
                expect(sessionLoggedOutCount).toEqual(
                    1, "Session.logged_out fired wrong number of times",
                );
            });
        });

        it("should emit Session.logged_out on M_UNKNOWN_TOKEN (soft logout)", function() {
            const error = { errcode: 'M_UNKNOWN_TOKEN', soft_logout: true };
            httpBackend.when("GET", "/sync").respond(401, error);

            let sessionLoggedOutCount = 0;
            client.on("Session.logged_out", function(errObj) {
                sessionLoggedOutCount++;
                expect(errObj.data).toEqual(error);
            });

            client.startClient();

            return httpBackend.flushAllExpected().then(function() {
                expect(sessionLoggedOutCount).toEqual(
                    1, "Session.logged_out fired wrong number of times",
                );
            });
        });
    });
});
