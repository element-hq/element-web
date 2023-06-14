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

import HttpBackend from "matrix-mock-request";

import {
    ClientEvent,
    HttpApiEvent,
    IEvent,
    MatrixClient,
    RoomEvent,
    RoomMemberEvent,
    RoomStateEvent,
    UserEvent,
} from "../../src";
import * as utils from "../test-utils/test-utils";
import { TestClient } from "../TestClient";

describe("MatrixClient events", function () {
    const selfUserId = "@alice:localhost";
    const selfAccessToken = "aseukfgwef";
    let client: MatrixClient | undefined;
    let httpBackend: HttpBackend | undefined;

    const setupTests = (): [MatrixClient, HttpBackend] => {
        const testClient = new TestClient(selfUserId, "DEVICE", selfAccessToken);
        const client = testClient.client;
        const httpBackend = testClient.httpBackend;
        httpBackend!.when("GET", "/versions").respond(200, {});
        httpBackend!.when("GET", "/pushrules").respond(200, {});
        httpBackend!.when("POST", "/filter").respond(200, { filter_id: "a filter id" });

        return [client!, httpBackend];
    };

    beforeEach(function () {
        [client!, httpBackend] = setupTests();
    });

    afterEach(function () {
        httpBackend?.verifyNoOutstandingExpectation();
        client?.stopClient();
        return httpBackend?.stop();
    });

    describe("emissions", function () {
        const SYNC_DATA = {
            next_batch: "s_5_3",
            presence: {
                events: [
                    utils.mkPresence({
                        user: "@foo:bar",
                        name: "Foo Bar",
                        presence: "online",
                    }),
                ],
            },
            rooms: {
                join: {
                    "!erufh:bar": {
                        timeline: {
                            events: [
                                utils.mkMessage({
                                    room: "!erufh:bar",
                                    user: "@foo:bar",
                                    msg: "hmmm",
                                }),
                            ],
                            prev_batch: "s",
                        },
                        state: {
                            events: [
                                utils.mkMembership({
                                    room: "!erufh:bar",
                                    mship: "join",
                                    user: "@foo:bar",
                                }),
                                utils.mkEvent({
                                    type: "m.room.create",
                                    room: "!erufh:bar",
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
                                    room: "!erufh:bar",
                                    user: "@foo:bar",
                                    msg: "ello ello",
                                }),
                                utils.mkMessage({
                                    room: "!erufh:bar",
                                    user: "@foo:bar",
                                    msg: ":D",
                                }),
                            ],
                        },
                        ephemeral: {
                            events: [
                                utils.mkEvent({
                                    type: "m.typing",
                                    room: "!erufh:bar",
                                    content: {
                                        user_ids: ["@foo:bar"],
                                    },
                                }),
                            ],
                        },
                    },
                },
            },
        };

        it("should emit events from both the first and subsequent /sync calls", function () {
            httpBackend!.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend!.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);

            let expectedEvents: Partial<IEvent>[] = [];
            expectedEvents = expectedEvents.concat(
                SYNC_DATA.presence.events,
                SYNC_DATA.rooms.join["!erufh:bar"].timeline.events,
                SYNC_DATA.rooms.join["!erufh:bar"].state.events,
                NEXT_SYNC_DATA.rooms.join["!erufh:bar"].timeline.events,
                NEXT_SYNC_DATA.rooms.join["!erufh:bar"].ephemeral.events,
            );

            client!.on(ClientEvent.Event, function (event) {
                let found = false;
                for (let i = 0; i < expectedEvents.length; i++) {
                    if (expectedEvents[i].event_id === event.getId()) {
                        expectedEvents.splice(i, 1);
                        found = true;
                        break;
                    }
                }
                expect(found).toBe(true);
            });

            client!.startClient();

            return Promise.all([
                // wait for two SYNCING events
                utils.syncPromise(client!).then(() => {
                    return utils.syncPromise(client!);
                }),
                httpBackend!.flushAllExpected(),
            ]).then(() => {
                expect(expectedEvents.length).toEqual(0);
            });
        });

        it("should emit User events", async () => {
            httpBackend!.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend!.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);
            let fired = false;
            client!.on(UserEvent.Presence, function (event, user) {
                fired = true;
                expect(user).toBeTruthy();
                expect(event).toBeTruthy();
                if (!user || !event) {
                    return;
                }

                expect(event.event).toEqual(SYNC_DATA.presence.events[0]);
                expect(user.presence).toEqual(SYNC_DATA.presence.events[0]?.content?.presence);
            });
            client!.startClient();

            await httpBackend!.flushAllExpected();
            expect(fired).toBe(true);
        });

        it("should emit Room events", function () {
            httpBackend!.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend!.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);
            let roomInvokeCount = 0;
            let roomNameInvokeCount = 0;
            let timelineFireCount = 0;
            client!.on(ClientEvent.Room, function (room) {
                roomInvokeCount++;
                expect(room.roomId).toEqual("!erufh:bar");
            });
            client!.on(RoomEvent.Timeline, function (event, room) {
                timelineFireCount++;
                expect(room?.roomId).toEqual("!erufh:bar");
            });
            client!.on(RoomEvent.Name, function (room) {
                roomNameInvokeCount++;
            });

            client!.startClient();

            return Promise.all([httpBackend!.flushAllExpected(), utils.syncPromise(client!, 2)]).then(function () {
                expect(roomInvokeCount).toEqual(1);
                expect(roomNameInvokeCount).toEqual(1);
                expect(timelineFireCount).toEqual(3);
            });
        });

        it("should emit RoomState events", function () {
            httpBackend!.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend!.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);

            const roomStateEventTypes = ["m.room.member", "m.room.create"];
            let eventsInvokeCount = 0;
            let membersInvokeCount = 0;
            let newMemberInvokeCount = 0;
            client!.on(RoomStateEvent.Events, function (event, state) {
                eventsInvokeCount++;
                const index = roomStateEventTypes.indexOf(event.getType());
                expect(index).not.toEqual(-1);
                if (index >= 0) {
                    roomStateEventTypes.splice(index, 1);
                }
            });
            client!.on(RoomStateEvent.Members, function (event, state, member) {
                membersInvokeCount++;
                expect(member.roomId).toEqual("!erufh:bar");
                expect(member.userId).toEqual("@foo:bar");
                expect(member.membership).toEqual("join");
            });
            client!.on(RoomStateEvent.NewMember, function (event, state, member) {
                newMemberInvokeCount++;
                expect(member.roomId).toEqual("!erufh:bar");
                expect(member.userId).toEqual("@foo:bar");
                expect(member.membership).toBeFalsy();
            });

            client!.startClient();

            return Promise.all([httpBackend!.flushAllExpected(), utils.syncPromise(client!, 2)]).then(function () {
                expect(membersInvokeCount).toEqual(1);
                expect(newMemberInvokeCount).toEqual(1);
                expect(eventsInvokeCount).toEqual(2);
            });
        });

        it("should emit RoomMember events", function () {
            httpBackend!.when("GET", "/sync").respond(200, SYNC_DATA);
            httpBackend!.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);

            let typingInvokeCount = 0;
            let powerLevelInvokeCount = 0;
            let nameInvokeCount = 0;
            let membershipInvokeCount = 0;
            client!.on(RoomMemberEvent.Name, function (event, member) {
                nameInvokeCount++;
            });
            client!.on(RoomMemberEvent.Typing, function (event, member) {
                typingInvokeCount++;
                expect(member.typing).toBe(true);
            });
            client!.on(RoomMemberEvent.PowerLevel, function (event, member) {
                powerLevelInvokeCount++;
            });
            client!.on(RoomMemberEvent.Membership, function (event, member) {
                membershipInvokeCount++;
                expect(member.membership).toEqual("join");
            });

            client!.startClient();

            return Promise.all([httpBackend!.flushAllExpected(), utils.syncPromise(client!, 2)]).then(function () {
                expect(typingInvokeCount).toEqual(1);
                expect(powerLevelInvokeCount).toEqual(0);
                expect(nameInvokeCount).toEqual(0);
                expect(membershipInvokeCount).toEqual(1);
            });
        });

        it("should emit Session.logged_out on M_UNKNOWN_TOKEN", function () {
            const error = { errcode: "M_UNKNOWN_TOKEN" };
            httpBackend!.when("GET", "/sync").respond(401, error);

            let sessionLoggedOutCount = 0;
            client!.on(HttpApiEvent.SessionLoggedOut, function (errObj) {
                sessionLoggedOutCount++;
                expect(errObj.data).toEqual(error);
            });

            client!.startClient();

            return httpBackend!.flushAllExpected().then(function () {
                expect(sessionLoggedOutCount).toEqual(1);
            });
        });

        it("should emit Session.logged_out on M_UNKNOWN_TOKEN (soft logout)", function () {
            const error = { errcode: "M_UNKNOWN_TOKEN", soft_logout: true };
            httpBackend!.when("GET", "/sync").respond(401, error);

            let sessionLoggedOutCount = 0;
            client!.on(HttpApiEvent.SessionLoggedOut, function (errObj) {
                sessionLoggedOutCount++;
                expect(errObj.data).toEqual(error);
            });

            client!.startClient();

            return httpBackend!.flushAllExpected().then(function () {
                expect(sessionLoggedOutCount).toEqual(1);
            });
        });
    });
});
