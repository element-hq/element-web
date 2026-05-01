/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, JoinRule, type MatrixClient, type Room, Room as SDKRoom } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import shouldHideEvent from "../../src/shouldHideEvent";
import { mkEvent } from "../test-utils/test-utils";

describe("shouldHideEvent", () => {
    let client: MatrixClient;
    let publicRoom: Room;
    let privateRoom: Room;

    beforeEach(() => {
        client = {
            getRoom: jest.fn().mockImplementation((roomId: string) => {
                if (roomId === "!public:server") return publicRoom;
                if (roomId === "!private:server") return privateRoom;
                return null;
            }),
        } as unknown as MatrixClient;

        publicRoom = new SDKRoom("!public:server", client, "@user:server");
        privateRoom = new SDKRoom("!private:server", client, "@user:server");

        (publicRoom as unknown as { getJoinRule: jest.Mock }).getJoinRule = jest.fn().mockReturnValue(JoinRule.Public);
        (privateRoom as unknown as { getJoinRule: jest.Mock }).getJoinRule = jest
            .fn()
            .mockReturnValue(JoinRule.Private);
    });

    function makeMemberEvent(
        roomId: string,
        membership: KnownMembership,
        prevMembership?: KnownMembership,
    ): ReturnType<typeof mkEvent> {
        return mkEvent({
            type: EventType.RoomMember,
            room: roomId,
            user: "@user:server",
            content: {
                membership,
                displayname: "User",
                avatar_url: "mxc://avatar",
            },
            prev_content:
                prevMembership !== undefined
                    ? {
                          membership: prevMembership,
                          displayname: "User",
                          avatar_url: "mxc://avatar",
                      }
                    : undefined,
            event: true,
        });
    }

    function makeTopicEvent(roomId: string): ReturnType<typeof mkEvent> {
        return mkEvent({
            type: EventType.RoomTopic,
            room: roomId,
            user: "@user:server",
            skey: "",
            content: {
                topic: "Test Topic",
            },
            event: true,
        });
    }

    describe("public room events", () => {
        it("should hide member join events in public rooms", () => {
            const event = makeMemberEvent("!public:server", KnownMembership.Join, KnownMembership.Invite);
            expect(shouldHideEvent(event, undefined, client)).toBe(true);
        });

        it("should hide member leave events in public rooms", () => {
            const event = makeMemberEvent("!public:server", KnownMembership.Leave, KnownMembership.Join);
            expect(shouldHideEvent(event, undefined, client)).toBe(true);
        });

        it("should hide topic events in public rooms", () => {
            const event = makeTopicEvent("!public:server");
            expect(shouldHideEvent(event, undefined, client)).toBe(true);
        });
    });

    describe("non-public room events", () => {
        it("should show member join events in private rooms", () => {
            const event = makeMemberEvent("!private:server", KnownMembership.Join, KnownMembership.Invite);
            expect(shouldHideEvent(event, undefined, client)).toBe(false);
        });

        it("should show member leave events in private rooms", () => {
            const event = makeMemberEvent("!private:server", KnownMembership.Leave, KnownMembership.Join);
            expect(shouldHideEvent(event, undefined, client)).toBe(false);
        });

        it("should show topic events in private rooms", () => {
            const event = makeTopicEvent("!private:server");
            expect(shouldHideEvent(event, undefined, client)).toBe(false);
        });
    });
});
