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

import fetchMock from "fetch-mock-jest";

import * as utils from "../test-utils/test-utils";
import { RoomMember, RoomMemberEvent } from "../../src/models/room-member";
import {
    createClient,
    EventType,
    MatrixClient,
    RoomState,
    UNSTABLE_MSC2666_MUTUAL_ROOMS,
    UNSTABLE_MSC2666_QUERY_MUTUAL_ROOMS,
    UNSTABLE_MSC2666_SHARED_ROOMS,
} from "../../src";

describe("RoomMember", function () {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";
    const userB = "@bertha:bar";
    const userC = "@clarissa:bar";
    let member = new RoomMember(roomId, userA);

    beforeEach(function () {
        member = new RoomMember(roomId, userA);
    });

    describe("getAvatarUrl", function () {
        const hsUrl = "https://my.home.server";

        it("should return the URL from m.room.member preferentially", function () {
            member.events.member = utils.mkEvent({
                event: true,
                type: "m.room.member",
                skey: userA,
                room: roomId,
                user: userA,
                content: {
                    membership: "join",
                    avatar_url: "mxc://flibble/wibble",
                },
            });
            const url = member.getAvatarUrl(hsUrl, 1, 1, "", false, false);
            // we don't care about how the mxc->http conversion is done, other
            // than it contains the mxc body.
            expect(url?.indexOf("flibble/wibble")).not.toEqual(-1);
        });

        it("should return nothing if there is no m.room.member and allowDefault=false", function () {
            const url = member.getAvatarUrl(hsUrl, 64, 64, "crop", false, false);
            expect(url).toEqual(null);
        });
    });

    describe("setPowerLevelEvent", function () {
        it("should set 'powerLevel' and 'powerLevelNorm'.", function () {
            const event = utils.mkEvent({
                type: "m.room.power_levels",
                room: roomId,
                user: userA,
                content: {
                    users_default: 20,
                    users: {
                        "@bertha:bar": 200,
                        "@invalid:user": 10, // shouldn't barf on this.
                    },
                },
                event: true,
            });
            member.setPowerLevelEvent(event);
            expect(member.powerLevel).toEqual(20);
            expect(member.powerLevelNorm).toEqual(10);

            const memberB = new RoomMember(roomId, userB);
            memberB.setPowerLevelEvent(event);
            expect(memberB.powerLevel).toEqual(200);
            expect(memberB.powerLevelNorm).toEqual(100);
        });

        it("should emit 'RoomMember.powerLevel' if the power level changes.", function () {
            const event = utils.mkEvent({
                type: "m.room.power_levels",
                room: roomId,
                user: userA,
                content: {
                    users_default: 20,
                    users: {
                        "@bertha:bar": 200,
                        "@invalid:user": 10, // shouldn't barf on this.
                    },
                },
                event: true,
            });
            let emitCount = 0;

            member.on(RoomMemberEvent.PowerLevel, function (emitEvent, emitMember) {
                emitCount += 1;
                expect(emitMember).toEqual(member);
                expect(emitEvent).toEqual(event);
            });

            member.setPowerLevelEvent(event);
            expect(emitCount).toEqual(1);
            member.setPowerLevelEvent(event); // no-op
            expect(emitCount).toEqual(1);
        });

        it("should honour power levels of zero.", function () {
            const event = utils.mkEvent({
                type: "m.room.power_levels",
                room: roomId,
                user: userA,
                content: {
                    users_default: 20,
                    users: {
                        "@alice:bar": 0,
                    },
                },
                event: true,
            });
            let emitCount = 0;

            // set the power level to something other than zero or we
            // won't get an event
            member.powerLevel = 1;
            member.on(RoomMemberEvent.PowerLevel, function (emitEvent, emitMember) {
                emitCount += 1;
                expect(emitMember.userId).toEqual("@alice:bar");
                expect(emitMember.powerLevel).toEqual(0);
                expect(emitEvent).toEqual(event);
            });

            member.setPowerLevelEvent(event);
            expect(member.powerLevel).toEqual(0);
            expect(emitCount).toEqual(1);
        });

        it("should not honor string power levels.", function () {
            const event = utils.mkEvent({
                type: "m.room.power_levels",
                room: roomId,
                user: userA,
                content: {
                    users_default: 20,
                    users: {
                        "@alice:bar": "5",
                    },
                },
                event: true,
            });
            let emitCount = 0;

            member.on(RoomMemberEvent.PowerLevel, function (emitEvent, emitMember) {
                emitCount += 1;
                expect(emitMember.userId).toEqual("@alice:bar");
                expect(emitMember.powerLevel).toEqual(20);
                expect(emitEvent).toEqual(event);
            });

            member.setPowerLevelEvent(event);
            expect(member.powerLevel).toEqual(20);
            expect(emitCount).toEqual(1);
        });

        it("should no-op if given a non-state or unrelated event", () => {
            const fn = jest.spyOn(member, "emit");
            expect(fn).not.toHaveBeenCalledWith(RoomMemberEvent.PowerLevel);
            member.setPowerLevelEvent(
                utils.mkEvent({
                    type: EventType.RoomPowerLevels,
                    room: roomId,
                    user: userA,
                    content: {
                        users_default: 20,
                        users: {
                            "@alice:bar": "5",
                        },
                    },
                    skey: "invalid",
                    event: true,
                }),
            );
            const nonStateEv = utils.mkEvent({
                type: EventType.RoomPowerLevels,
                room: roomId,
                user: userA,
                content: {
                    users_default: 20,
                    users: {
                        "@alice:bar": "5",
                    },
                },
                event: true,
            });
            delete nonStateEv.event.state_key;
            member.setPowerLevelEvent(nonStateEv);
            member.setPowerLevelEvent(
                utils.mkEvent({
                    type: EventType.Sticker,
                    room: roomId,
                    user: userA,
                    content: {},
                    event: true,
                }),
            );
            expect(fn).not.toHaveBeenCalledWith(RoomMemberEvent.PowerLevel);
        });
    });

    describe("setTypingEvent", function () {
        it("should set 'typing'", function () {
            member.typing = false;
            const memberB = new RoomMember(roomId, userB);
            memberB.typing = true;
            const memberC = new RoomMember(roomId, userC);
            memberC.typing = true;

            const event = utils.mkEvent({
                type: "m.typing",
                user: userA,
                room: roomId,
                content: {
                    user_ids: [userA, userC],
                },
                event: true,
            });
            member.setTypingEvent(event);
            memberB.setTypingEvent(event);
            memberC.setTypingEvent(event);

            expect(member.typing).toEqual(true);
            expect(memberB.typing).toEqual(false);
            expect(memberC.typing).toEqual(true);
        });

        it("should emit 'RoomMember.typing' if the typing state changes", function () {
            const event = utils.mkEvent({
                type: "m.typing",
                room: roomId,
                content: {
                    user_ids: [userA, userC],
                },
                event: true,
            });
            let emitCount = 0;
            member.on(RoomMemberEvent.Typing, function (ev, mem) {
                expect(mem).toEqual(member);
                expect(ev).toEqual(event);
                emitCount += 1;
            });
            member.typing = false;
            member.setTypingEvent(event);
            expect(emitCount).toEqual(1);
            member.setTypingEvent(event); // no-op
            expect(emitCount).toEqual(1);
        });
    });

    describe("isOutOfBand", function () {
        it("should be set by markOutOfBand", function () {
            const member = new RoomMember(roomId, userA);
            expect(member.isOutOfBand()).toEqual(false);
            member.markOutOfBand();
            expect(member.isOutOfBand()).toEqual(true);
        });
    });

    describe("isKicked", () => {
        it("should return false if membership is not `leave`", () => {
            const member1 = new RoomMember(roomId, userA);
            member1.membership = "join";
            expect(member1.isKicked()).toBeFalsy();

            const member2 = new RoomMember(roomId, userA);
            member2.membership = "invite";
            expect(member2.isKicked()).toBeFalsy();

            const member3 = new RoomMember(roomId, userA);
            expect(member3.isKicked()).toBeFalsy();
        });

        it("should return false if the membership event is unknown", () => {
            const member = new RoomMember(roomId, userA);
            member.membership = "leave";
            expect(member.isKicked()).toBeFalsy();
        });

        it("should return false if the member left of their own accord", () => {
            const member = new RoomMember(roomId, userA);
            member.membership = "leave";
            member.events.member = utils.mkMembership({
                event: true,
                sender: userA,
                mship: "leave",
                skey: userA,
            });
            expect(member.isKicked()).toBeFalsy();
        });

        it("should return true if the member's leave was sent by another user", () => {
            const member = new RoomMember(roomId, userA);
            member.membership = "leave";
            member.events.member = utils.mkMembership({
                event: true,
                sender: userB,
                mship: "leave",
                skey: userA,
            });
            expect(member.isKicked()).toBeTruthy();
        });
    });

    describe("getDMInviter", () => {
        it("should return userId of the sender of the invite if is_direct=true", () => {
            const member = new RoomMember(roomId, userA);
            member.membership = "invite";
            member.events.member = utils.mkMembership({
                event: true,
                sender: userB,
                mship: "invite",
                skey: userA,
            });
            member.events.member.event.content!.is_direct = true;
            expect(member.getDMInviter()).toBe(userB);
        });

        it("should not return userId of the sender of the invite if is_direct=false", () => {
            const member = new RoomMember(roomId, userA);
            member.membership = "invite";
            member.events.member = utils.mkMembership({
                event: true,
                sender: userB,
                mship: "invite",
                skey: userA,
            });
            member.events.member.event.content!.is_direct = false;
            expect(member.getDMInviter()).toBeUndefined();
        });
    });

    describe("setMembershipEvent", function () {
        const joinEvent = utils.mkMembership({
            event: true,
            mship: "join",
            user: userA,
            room: roomId,
            name: "Alice",
        });

        const inviteEvent = utils.mkMembership({
            event: true,
            mship: "invite",
            user: userB,
            skey: userA,
            room: roomId,
        });

        it("should set 'membership' and assign the event to 'events.member'.", function () {
            member.setMembershipEvent(inviteEvent);
            expect(member.membership).toEqual("invite");
            expect(member.events.member).toEqual(inviteEvent);
            member.setMembershipEvent(joinEvent);
            expect(member.membership).toEqual("join");
            expect(member.events.member).toEqual(joinEvent);
        });

        it("should set 'name' based on user_id, displayname and room state", function () {
            const roomState = {
                getStateEvents: function (type: string) {
                    if (type !== "m.room.member") {
                        return [];
                    }
                    return [
                        utils.mkMembership({
                            event: true,
                            mship: "join",
                            room: roomId,
                            user: userB,
                        }),
                        utils.mkMembership({
                            event: true,
                            mship: "join",
                            room: roomId,
                            user: userC,
                            name: "Alice",
                        }),
                        joinEvent,
                    ];
                },
                getUserIdsWithDisplayName: function (displayName: string) {
                    return [userA, userC];
                },
            } as unknown as RoomState;
            expect(member.name).toEqual(userA); // default = user_id
            member.setMembershipEvent(joinEvent);
            expect(member.name).toEqual("Alice"); // prefer displayname
            member.setMembershipEvent(joinEvent, roomState);
            expect(member.name).not.toEqual("Alice"); // it should disambig.
            // user_id should be there somewhere
            expect(member.name.indexOf(userA)).not.toEqual(-1);
        });

        it("should emit 'RoomMember.membership' if the membership changes", function () {
            let emitCount = 0;
            member.on(RoomMemberEvent.Membership, function (ev, mem) {
                emitCount += 1;
                expect(mem).toEqual(member);
                expect(ev).toEqual(inviteEvent);
            });
            member.setMembershipEvent(inviteEvent);
            expect(emitCount).toEqual(1);
            member.setMembershipEvent(inviteEvent); // no-op
            expect(emitCount).toEqual(1);
        });

        it("should emit 'RoomMember.name' if the name changes", function () {
            let emitCount = 0;
            member.on(RoomMemberEvent.Name, function (ev, mem) {
                emitCount += 1;
                expect(mem).toEqual(member);
                expect(ev).toEqual(joinEvent);
            });
            member.setMembershipEvent(joinEvent);
            expect(emitCount).toEqual(1);
            member.setMembershipEvent(joinEvent); // no-op
            expect(emitCount).toEqual(1);
        });

        it("should set 'name' to user_id if it is just whitespace", function () {
            const joinEvent = utils.mkMembership({
                event: true,
                mship: "join",
                user: userA,
                room: roomId,
                name: " \u200b ",
            });

            expect(member.name).toEqual(userA); // default = user_id
            member.setMembershipEvent(joinEvent);
            expect(member.name).toEqual(userA); // it should fallback because all whitespace
        });

        it("should disambiguate users on a fuzzy displayname match", function () {
            const joinEvent = utils.mkMembership({
                event: true,
                mship: "join",
                user: userA,
                room: roomId,
                name: "Alíce\u200b", // note diacritic and zero width char
            });

            const roomState = {
                getStateEvents: function (type: string) {
                    if (type !== "m.room.member") {
                        return [];
                    }
                    return [
                        utils.mkMembership({
                            event: true,
                            mship: "join",
                            room: roomId,
                            user: userC,
                            name: "Alice",
                        }),
                        joinEvent,
                    ];
                },
                getUserIdsWithDisplayName: function (displayName: string) {
                    return [userA, userC];
                },
            } as unknown as RoomState;
            expect(member.name).toEqual(userA); // default = user_id
            member.setMembershipEvent(joinEvent, roomState);
            expect(member.name).not.toEqual("Alíce"); // it should disambig.
            // user_id should be there somewhere
            expect(member.name.indexOf(userA)).not.toEqual(-1);
        });
    });
});

describe("MutualRooms", () => {
    let client: MatrixClient;
    const HS_URL = "https://example.com";
    const TEST_USER_ID = "@alice:localhost";
    const TEST_DEVICE_ID = "xzcvb";
    const QUERIED_USER = "@user:example.com";

    beforeEach(async () => {
        // anything that we don't have a specific matcher for silently returns a 404
        fetchMock.catch(404);
        fetchMock.config.warnOnFallback = true;

        client = createClient({
            baseUrl: HS_URL,
            userId: TEST_USER_ID,
            accessToken: "akjgkrgjs",
            deviceId: TEST_DEVICE_ID,
        });
    });

    afterEach(async () => {
        await client.stopClient();
        fetchMock.mockReset();
    });

    function enableFeature(feature: string) {
        const mapping: Record<string, boolean> = {};

        mapping[feature] = true;

        fetchMock.get(`${HS_URL}/_matrix/client/versions`, {
            unstable_features: mapping,
            versions: ["v1.1"],
        });
    }

    it("supports the initial MSC version (shared rooms)", async () => {
        enableFeature(UNSTABLE_MSC2666_SHARED_ROOMS);

        fetchMock.get("express:/_matrix/client/unstable/uk.half-shot.msc2666/user/shared_rooms/:user_id", (rawUrl) => {
            const segments = rawUrl.split("/");
            const lastSegment = decodeURIComponent(segments[segments.length - 1]);

            expect(lastSegment).toEqual(QUERIED_USER);

            return {
                joined: ["!test:example.com"],
            };
        });

        const rooms = await client._unstable_getSharedRooms(QUERIED_USER);

        expect(rooms).toEqual(["!test:example.com"]);
    });

    it("supports the renaming MSC version (mutual rooms)", async () => {
        enableFeature(UNSTABLE_MSC2666_MUTUAL_ROOMS);

        fetchMock.get("express:/_matrix/client/unstable/uk.half-shot.msc2666/user/mutual_rooms/:user_id", (rawUrl) => {
            const segments = rawUrl.split("/");
            const lastSegment = decodeURIComponent(segments[segments.length - 1]);

            expect(lastSegment).toEqual(QUERIED_USER);

            return {
                joined: ["!test2:example.com"],
            };
        });

        const rooms = await client._unstable_getSharedRooms(QUERIED_USER);

        expect(rooms).toEqual(["!test2:example.com"]);
    });

    describe("can work the latest MSC version (query mutual rooms)", () => {
        beforeEach(() => {
            enableFeature(UNSTABLE_MSC2666_QUERY_MUTUAL_ROOMS);
        });

        it("works with a simple response", async () => {
            fetchMock.get("express:/_matrix/client/unstable/uk.half-shot.msc2666/user/mutual_rooms", (rawUrl) => {
                const url = new URL(rawUrl);

                expect(url.searchParams.get("user_id")).toEqual(QUERIED_USER);

                return {
                    joined: ["!test3:example.com"],
                };
            });

            const rooms = await client._unstable_getSharedRooms(QUERIED_USER);

            expect(rooms).toEqual(["!test3:example.com"]);
        });

        it("works with a paginated response", async () => {
            fetchMock.get("express:/_matrix/client/unstable/uk.half-shot.msc2666/user/mutual_rooms", (rawUrl) => {
                const url = new URL(rawUrl);

                expect(url.searchParams.get("user_id")).toEqual(QUERIED_USER);

                const token = url.searchParams.get("batch_token");

                if (token == "yahaha") {
                    return {
                        joined: ["!korok:example.com"],
                    };
                } else {
                    return {
                        joined: ["!rock:example.com"],
                        next_batch_token: "yahaha",
                    };
                }
            });

            const rooms = await client._unstable_getSharedRooms(QUERIED_USER);

            expect(rooms).toEqual(["!rock:example.com", "!korok:example.com"]);
        });
    });
});
