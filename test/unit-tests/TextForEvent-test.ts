/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    EventType,
    HistoryVisibility,
    JoinRule,
    type MatrixClient,
    MatrixEvent,
    type MRoomTopicEventContent,
    Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { render } from "jest-matrix-react";
import { type ReactElement } from "react";
import { type Mocked, mocked } from "jest-mock";

import { textForEvent } from "../../src/TextForEvent";
import SettingsStore from "../../src/settings/SettingsStore";
import { createTestClient, stubClient } from "../test-utils";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import UserIdentifierCustomisations from "../../src/customisations/UserIdentifier";
import { ElementCall } from "../../src/models/Call";
import { getSenderName } from "../../src/utils/event/getSenderName";

jest.mock("../../src/settings/SettingsStore");
jest.mock("../../src/customisations/UserIdentifier", () => ({
    getDisplayUserIdentifier: jest.fn().mockImplementation((userId) => userId),
}));

function mockPinnedEvent(pinnedMessageIds?: string[], prevPinnedMessageIds?: string[]): MatrixEvent {
    return new MatrixEvent({
        type: "m.room.pinned_events",
        state_key: "",
        sender: "@foo:example.com",
        content: {
            pinned: pinnedMessageIds,
        },
        unsigned: {
            prev_content: {
                pinned: prevPinnedMessageIds,
            },
        },
    });
}

describe("TextForEvent", () => {
    const mockClient = createTestClient();

    describe("getSenderName()", () => {
        it("Prefers sender.name", () => {
            expect(getSenderName({ sender: { name: "Alice" } } as MatrixEvent)).toBe("Alice");
        });
        it("Handles missing sender", () => {
            expect(getSenderName({ getSender: () => "Alice" } as MatrixEvent)).toBe("Alice");
        });
        it("Handles missing sender and get sender", () => {
            expect(getSenderName({ getSender: () => undefined } as MatrixEvent)).toBe("Someone");
        });
    });

    describe("TextForPinnedEvent", () => {
        it("mentions message when a single message was pinned, with no previously pinned messages", () => {
            const event = mockPinnedEvent(["message-1"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com pinned a message to this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });

        it("mentions message when a single message was pinned, with multiple previously pinned messages", () => {
            const event = mockPinnedEvent(["message-1", "message-2", "message-3"], ["message-1", "message-2"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com pinned a message to this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });

        it("mentions message when a single message was unpinned, with a single message previously pinned", () => {
            const event = mockPinnedEvent([], ["message-1"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com unpinned a message from this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });

        it("mentions message when a single message was unpinned, with multiple previously pinned messages", () => {
            const event = mockPinnedEvent(["message-2"], ["message-1", "message-2"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com unpinned a message from this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });

        it("shows generic text when multiple messages were pinned", () => {
            const event = mockPinnedEvent(["message-1", "message-2", "message-3"], ["message-1"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });

        it("shows generic text when multiple messages were unpinned", () => {
            const event = mockPinnedEvent(["message-3"], ["message-1", "message-2", "message-3"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });

        it("shows generic text when one message was pinned, and another unpinned", () => {
            const event = mockPinnedEvent(["message-2"], ["message-1"]);
            const plainText = textForEvent(event, mockClient);
            const component = render(textForEvent(event, mockClient, true) as ReactElement);

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(component.container).toHaveTextContent(expectedText);
        });
    });

    describe("textForPowerEvent()", () => {
        let mockClient: Mocked<MatrixClient>;
        const mockRoom = {
            getMember: jest.fn(),
        } as unknown as Mocked<Room>;

        const userA = {
            userId: "@a",
            name: "Alice",
            rawDisplayName: "Alice",
        } as RoomMember;
        const userB = {
            userId: "@b",
            name: "Bob (@b)",
            rawDisplayName: "Bob",
        } as RoomMember;
        const userC = {
            userId: "@c",
            name: "Bob (@c)",
            rawDisplayName: "Bob",
        } as RoomMember;
        interface PowerEventProps {
            usersDefault?: number;
            prevDefault?: number;
            users: Record<string, number>;
            prevUsers: Record<string, number>;
        }
        const mockPowerEvent = ({ usersDefault, prevDefault, users, prevUsers }: PowerEventProps): MatrixEvent => {
            const mxEvent = new MatrixEvent({
                type: EventType.RoomPowerLevels,
                sender: userA.userId,
                state_key: "",
                content: {
                    users_default: usersDefault,
                    users,
                },
                unsigned: {
                    prev_content: {
                        users: prevUsers,
                        users_default: prevDefault,
                    },
                },
            });
            mxEvent.sender = { name: userA.name } as RoomMember;
            return mxEvent;
        };

        beforeAll(() => {
            mockClient = createTestClient() as Mocked<MatrixClient>;
            MatrixClientPeg.get = () => mockClient;
            MatrixClientPeg.safeGet = () => mockClient;
            mockClient.getRoom.mockClear().mockReturnValue(mockRoom);
            mockRoom.getMember
                .mockClear()
                .mockImplementation((userId) => [userA, userB, userC].find((u) => u.userId === userId) || null);
            (SettingsStore.getValue as jest.Mock).mockReturnValue(true);
        });

        beforeEach(() => {
            (UserIdentifierCustomisations.getDisplayUserIdentifier as jest.Mock)
                .mockClear()
                .mockImplementation((userId) => userId);
        });

        it("returns falsy when no users have changed power level", () => {
            const event = mockPowerEvent({
                users: {
                    [userA.userId]: 100,
                },
                prevUsers: {
                    [userA.userId]: 100,
                },
            });
            expect(textForEvent(event, mockClient)).toBeFalsy();
        });

        it("returns false when users power levels have been changed by default settings", () => {
            const event = mockPowerEvent({
                usersDefault: 100,
                prevDefault: 50,
                users: {
                    [userA.userId]: 100,
                },
                prevUsers: {
                    [userA.userId]: 50,
                },
            });
            expect(textForEvent(event, mockClient)).toBeFalsy();
        });

        it("returns correct message for a single user with changed power level", () => {
            const event = mockPowerEvent({
                users: {
                    [userB.userId]: 100,
                },
                prevUsers: {
                    [userB.userId]: 50,
                },
            });
            const expectedText = "Alice changed the power level of Bob (@b) from Moderator to Admin.";
            expect(textForEvent(event, mockClient)).toEqual(expectedText);
        });

        it("returns correct message for a single user with power level changed to the default", () => {
            const event = mockPowerEvent({
                usersDefault: 20,
                prevDefault: 101,
                users: {
                    [userB.userId]: 20,
                },
                prevUsers: {
                    [userB.userId]: 50,
                },
            });
            const expectedText = "Alice changed the power level of Bob (@b) from Moderator to Default.";
            expect(textForEvent(event, mockClient)).toEqual(expectedText);
        });

        it("returns correct message for a single user with power level changed to a custom level", () => {
            const event = mockPowerEvent({
                users: {
                    [userB.userId]: -1,
                },
                prevUsers: {
                    [userB.userId]: 50,
                },
            });
            const expectedText = "Alice changed the power level of Bob (@b) from Moderator to Custom (-1).";
            expect(textForEvent(event, mockClient)).toEqual(expectedText);
        });

        it("returns correct message for a multiple power level changes", () => {
            const event = mockPowerEvent({
                users: {
                    [userB.userId]: 100,
                    [userC.userId]: 50,
                },
                prevUsers: {
                    [userB.userId]: 50,
                    [userC.userId]: 101,
                },
            });
            const expectedText =
                "Alice changed the power level of Bob (@b) from Moderator to Admin," +
                " Bob (@c) from Custom (101) to Moderator.";
            expect(textForEvent(event, mockClient)).toEqual(expectedText);
        });
    });

    describe("textForCanonicalAliasEvent()", () => {
        const userA = {
            userId: "@a",
            name: "Alice",
        };

        interface AliasEventProps {
            alias?: string;
            prevAlias?: string;
            altAliases?: string[];
            prevAltAliases?: string[];
        }
        const mockEvent = ({ alias, prevAlias, altAliases, prevAltAliases }: AliasEventProps): MatrixEvent =>
            new MatrixEvent({
                type: EventType.RoomCanonicalAlias,
                sender: userA.userId,
                state_key: "",
                content: {
                    alias,
                    alt_aliases: altAliases,
                },
                unsigned: {
                    prev_content: {
                        alias: prevAlias,
                        alt_aliases: prevAltAliases,
                    },
                },
            });

        type TestCase = [string, AliasEventProps & { result: string }];
        const testCases: TestCase[] = [
            [
                "room alias didn't change",
                {
                    result: "@a changed the addresses for this room.",
                },
            ],
            [
                "room alias changed",
                {
                    alias: "banana",
                    prevAlias: "apple",
                    result: "@a set the main address for this room to banana.",
                },
            ],
            [
                "room alias was added",
                {
                    alias: "banana",
                    result: "@a set the main address for this room to banana.",
                },
            ],
            [
                "room alias was removed",
                {
                    prevAlias: "apple",
                    result: "@a removed the main address for this room.",
                },
            ],
            [
                "added an alt alias",
                {
                    altAliases: ["canteloupe"],
                    result: "@a added alternative address canteloupe for this room.",
                },
            ],
            [
                "added multiple alt aliases",
                {
                    altAliases: ["canteloupe", "date"],
                    result: "@a added the alternative addresses canteloupe, date for this room.",
                },
            ],
            [
                "removed an alt alias",
                {
                    altAliases: ["canteloupe"],
                    prevAltAliases: ["canteloupe", "date"],
                    result: "@a removed alternative address date for this room.",
                },
            ],
            [
                "added and removed an alt aliases",
                {
                    altAliases: ["canteloupe", "elderberry"],
                    prevAltAliases: ["canteloupe", "date"],
                    result: "@a changed the alternative addresses for this room.",
                },
            ],
            [
                "changed alias and added alt alias",
                {
                    alias: "banana",
                    prevAlias: "apple",
                    altAliases: ["canteloupe"],
                    result: "@a changed the main and alternative addresses for this room.",
                },
            ],
        ];

        it.each(testCases)("returns correct message when %s", (_d, { result, ...eventProps }) => {
            const event = mockEvent(eventProps);
            expect(textForEvent(event, mockClient)).toEqual(result);
        });
    });

    describe("textForPollStartEvent()", () => {
        let pollEvent: MatrixEvent;

        beforeEach(() => {
            pollEvent = new MatrixEvent({
                type: "org.matrix.msc3381.poll.start",
                sender: "@a",
                content: {
                    "org.matrix.msc3381.poll.start": {
                        answers: [{ "org.matrix.msc1767.text": "option1" }, { "org.matrix.msc1767.text": "option2" }],
                        question: {
                            "body": "Test poll name",
                            "msgtype": "m.text",
                            "org.matrix.msc1767.text": "Test poll name",
                        },
                    },
                },
            });
        });

        it("returns correct message for redacted poll start", () => {
            pollEvent.makeRedacted(pollEvent, new Room(pollEvent.getRoomId()!, mockClient, mockClient.getSafeUserId()));

            expect(textForEvent(pollEvent, mockClient)).toEqual("@a: Message deleted");
        });

        it("returns correct message for normal poll start", () => {
            expect(textForEvent(pollEvent, mockClient)).toEqual("@a has started a poll - ");
        });
    });

    describe("textForMessageEvent()", () => {
        let messageEvent: MatrixEvent;

        beforeEach(() => {
            messageEvent = new MatrixEvent({
                type: "m.room.message",
                sender: "@a",
                content: {
                    "body": "test message",
                    "msgtype": "m.text",
                    "org.matrix.msc1767.text": "test message",
                },
            });
        });

        it("returns correct message for redacted message", () => {
            messageEvent.makeRedacted(
                messageEvent,
                new Room(messageEvent.getRoomId()!, mockClient, mockClient.getSafeUserId()),
            );

            expect(textForEvent(messageEvent, mockClient)).toEqual("@a: Message deleted");
        });

        it("returns correct message for normal message", () => {
            expect(textForEvent(messageEvent, mockClient)).toEqual("@a: test message");
        });
    });

    describe("textForCallEvent()", () => {
        let mockClient: MatrixClient;
        let callEvent: MatrixEvent;

        beforeEach(() => {
            stubClient();
            mockClient = MatrixClientPeg.safeGet();

            mocked(mockClient.getRoom).mockReturnValue({
                name: "Test room",
            } as unknown as Room);

            callEvent = {
                getRoomId: jest.fn(),
                getType: jest.fn(),
                isState: jest.fn().mockReturnValue(true),
            } as unknown as MatrixEvent;
        });

        describe.each(ElementCall.CALL_EVENT_TYPE.names)("eventType=%s", (eventType: string) => {
            beforeEach(() => {
                mocked(callEvent).getType.mockReturnValue(eventType);
            });

            it("returns correct message for call event when supported", () => {
                expect(textForEvent(callEvent, mockClient)).toEqual("Video call started in Test room.");
            });

            it("returns correct message for call event when not supported", () => {
                mocked(mockClient).supportsVoip.mockReturnValue(false);

                expect(textForEvent(callEvent, mockClient)).toEqual(
                    "Video call started in Test room. (not supported by this browser)",
                );
            });
        });
    });

    describe("textForMemberEvent()", () => {
        beforeEach(() => {
            stubClient();
        });

        it("should handle both displayname and avatar changing in one event", () => {
            expect(
                textForEvent(
                    new MatrixEvent({
                        type: "m.room.member",
                        sender: "@a:foo",
                        content: {
                            membership: KnownMembership.Join,
                            avatar_url: "b",
                            displayname: "Bob",
                        },
                        unsigned: {
                            prev_content: {
                                membership: KnownMembership.Join,
                                avatar_url: "a",
                                displayname: "Andy",
                            },
                        },
                        state_key: "@a:foo",
                    }),
                    mockClient,
                ),
            ).toMatchInlineSnapshot(`"Andy changed their display name and profile picture"`);
        });
    });

    describe("textForJoinRulesEvent()", () => {
        type TestCase = [string, { result: string }];
        const testCases: TestCase[] = [
            [JoinRule.Public, { result: "@a made the room public to whoever knows the link." }],
            [JoinRule.Invite, { result: "@a made the room invite only." }],
            [JoinRule.Knock, { result: "@a changed the join rule to ask to join." }],
            [JoinRule.Restricted, { result: "@a changed who can join this room." }],
        ];

        it.each(testCases)("returns correct message when room join rule changed to %s", (joinRule, { result }) => {
            expect(
                textForEvent(
                    new MatrixEvent({
                        type: "m.room.join_rules",
                        sender: "@a",
                        content: {
                            join_rule: joinRule,
                        },
                        state_key: "",
                    }),
                    mockClient,
                ),
            ).toEqual(result);
        });

        it(`returns correct JSX message when room join rule changed to ${JoinRule.Restricted}`, () => {
            expect(
                textForEvent(
                    new MatrixEvent({
                        type: "m.room.join_rules",
                        sender: "@a",
                        content: {
                            join_rule: JoinRule.Restricted,
                        },
                        state_key: "",
                    }),
                    mockClient,
                    true,
                ),
            ).toMatchSnapshot();
        });

        it("returns correct default message", () => {
            expect(
                textForEvent(
                    new MatrixEvent({
                        type: "m.room.join_rules",
                        sender: "@a",
                        content: {
                            join_rule: "a not implemented one",
                        },
                        state_key: "",
                    }),
                    mockClient,
                ),
            ).toEqual("@a changed the join rule to a not implemented one");
        });
    });

    describe("textForHistoryVisibilityEvent()", () => {
        type TestCase = [string, { result: string }];
        const testCases: TestCase[] = [
            [
                HistoryVisibility.Invited,
                { result: "@a made future room history visible to all room members, from the point they are invited." },
            ],
            [
                HistoryVisibility.Joined,
                { result: "@a made future room history visible to all room members, from the point they joined." },
            ],
            [HistoryVisibility.Shared, { result: "@a made future room history visible to all room members." }],
            [HistoryVisibility.WorldReadable, { result: "@a made future room history visible to anyone." }],
        ];

        it.each(testCases)(
            "returns correct message when room join rule changed to %s",
            (historyVisibility, { result }) => {
                expect(
                    textForEvent(
                        new MatrixEvent({
                            type: "m.room.history_visibility",
                            sender: "@a",
                            content: {
                                history_visibility: historyVisibility,
                            },
                            state_key: "",
                        }),
                        mockClient,
                    ),
                ).toEqual(result);
            },
        );
    });

    describe("textForTopicEvent()", () => {
        type TestCase = [string, MRoomTopicEventContent, { result: string }];
        const testCases: TestCase[] = [
            ["the legacy key", { topic: "My topic" }, { result: '@a changed the topic to "My topic".' }],
            [
                "the legacy key with an empty m.topic key",
                { "topic": "My topic", "m.topic": [] },
                { result: '@a changed the topic to "My topic".' },
            ],
            [
                "the m.topic key",
                { "topic": "Ignore this", "m.topic": [{ mimetype: "text/plain", body: "My topic" }] },
                { result: '@a changed the topic to "My topic".' },
            ],
            [
                "the m.topic key and the legacy key undefined",
                { "topic": undefined, "m.topic": [{ mimetype: "text/plain", body: "My topic" }] },
                { result: '@a changed the topic to "My topic".' },
            ],
            ["the legacy key undefined", { topic: undefined }, { result: "@a removed the topic." }],
            ["the legacy key empty string", { topic: "" }, { result: "@a removed the topic." }],
            [
                "both the legacy and new keys removed",
                { "topic": undefined, "m.topic": [] },
                { result: "@a removed the topic." },
            ],
        ];

        it.each(testCases)("returns correct message for topic event with %s", (_caseName, content, { result }) => {
            expect(
                textForEvent(
                    new MatrixEvent({
                        type: "m.room.topic",
                        sender: "@a",
                        content: content,
                        state_key: "",
                    }),
                    mockClient,
                ),
            ).toEqual(result);
        });
    });
});
