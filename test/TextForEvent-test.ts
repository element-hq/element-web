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

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import TestRenderer from 'react-test-renderer';
import { ReactElement } from "react";

import { getSenderName, textForEvent } from "../src/TextForEvent";
import SettingsStore from "../src/settings/SettingsStore";
import { createTestClient } from './test-utils';
import { MatrixClientPeg } from '../src/MatrixClientPeg';
import UserIdentifierCustomisations from '../src/customisations/UserIdentifier';

jest.mock("../src/settings/SettingsStore");
jest.mock('../src/customisations/UserIdentifier', () => ({
    getDisplayUserIdentifier: jest.fn().mockImplementation(userId => userId),
}));

function mockPinnedEvent(
    pinnedMessageIds?: string[],
    prevPinnedMessageIds?: string[],
): MatrixEvent {
    return new MatrixEvent({
        type: "m.room.pinned_events",
        state_key: "",
        sender: "@foo:example.com",
        content: {
            pinned: pinnedMessageIds,
        },
        prev_content: {
            pinned: prevPinnedMessageIds,
        },
    });
}

// Helper function that renders a component to a plain text string.
// Once snapshots are introduced in tests, this function will no longer be necessary,
// and should be replaced with snapshots.
function renderComponent(component): string {
    const serializeObject = (object): string => {
        if (typeof object === 'string') {
            return object === ' ' ? '' : object;
        }

        if (Array.isArray(object) && object.length === 1 && typeof object[0] === 'string') {
            return object[0];
        }

        if (object['type'] !== undefined && typeof object['children'] !== undefined) {
            return serializeObject(object.children);
        }

        if (!Array.isArray(object)) {
            return '';
        }

        return object.map(child => {
            return serializeObject(child);
        }).join('');
    };

    return serializeObject(component.toJSON());
}

describe('TextForEvent', () => {
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
        beforeAll(() => {
            // enable feature_pinning setting
            (SettingsStore.getValue as jest.Mock).mockImplementation(feature => feature === 'feature_pinning');
        });

        it("mentions message when a single message was pinned, with no previously pinned messages", () => {
            const event = mockPinnedEvent(['message-1']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com pinned a message to this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("mentions message when a single message was pinned, with multiple previously pinned messages", () => {
            const event = mockPinnedEvent(['message-1', 'message-2', 'message-3'], ['message-1', 'message-2']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com pinned a message to this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("mentions message when a single message was unpinned, with a single message previously pinned", () => {
            const event = mockPinnedEvent([], ['message-1']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com unpinned a message from this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("mentions message when a single message was unpinned, with multiple previously pinned messages", () => {
            const event = mockPinnedEvent(['message-2'], ['message-1', 'message-2']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com unpinned a message from this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("shows generic text when multiple messages were pinned", () => {
            const event = mockPinnedEvent(['message-1', 'message-2', 'message-3'], ['message-1']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("shows generic text when multiple messages were unpinned", () => {
            const event = mockPinnedEvent(['message-3'], ['message-1', 'message-2', 'message-3']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("shows generic text when one message was pinned, and another unpinned", () => {
            const event = mockPinnedEvent(['message-2'], ['message-1']);
            const plainText = textForEvent(event);
            const component = TestRenderer.create(textForEvent(event, true) as ReactElement);

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });
    });

    describe("textForPowerEvent()", () => {
        let mockClient;
        const mockRoom = {
            getMember: jest.fn(),
        };

        const userA = {
            id: '@a',
            name: 'Alice',
        };
        const userB = {
            id: '@b',
            name: 'Bob',
        };
        const userC = {
            id: '@c',
            name: 'Carl',
        };
        interface PowerEventProps {
            usersDefault?: number;
            prevDefault?: number;
            users: Record<string, number>;
            prevUsers: Record<string, number>;
        }
        const mockPowerEvent = ({
            usersDefault, prevDefault, users, prevUsers,
        }: PowerEventProps): MatrixEvent => new MatrixEvent({
            type: EventType.RoomPowerLevels,
            sender: userA.id,
            state_key: "",
            content: {
                users_default: usersDefault,
                users,
            },
            prev_content: {
                users: prevUsers,
                users_default: prevDefault,
            },
        });

        beforeAll(() => {
            mockClient = createTestClient();
            MatrixClientPeg.get = () => mockClient;
            mockClient.getRoom.mockClear().mockReturnValue(mockRoom);
            mockRoom.getMember.mockClear().mockImplementation(
                userId => [userA, userB, userC].find(u => u.id === userId),
            );
            (SettingsStore.getValue as jest.Mock).mockReturnValue(true);
        });

        beforeEach(() => {
            (UserIdentifierCustomisations.getDisplayUserIdentifier as jest.Mock)
                .mockClear()
                .mockImplementation(userId => userId);
        });

        it("returns falsy when no users have changed power level", () => {
            const event = mockPowerEvent({
                users: {
                    [userA.id]: 100,
                },
                prevUsers: {
                    [userA.id]: 100,
                },
            });
            expect(textForEvent(event)).toBeFalsy();
        });

        it("returns false when users power levels have been changed by default settings", () => {
            const event = mockPowerEvent({
                usersDefault: 100,
                prevDefault: 50,
                users: {
                    [userA.id]: 100,
                },
                prevUsers: {
                    [userA.id]: 50,
                },
            });
            expect(textForEvent(event)).toBeFalsy();
        });

        it("returns correct message for a single user with changed power level", () => {
            const event = mockPowerEvent({
                users: {
                    [userB.id]: 100,
                },
                prevUsers: {
                    [userB.id]: 50,
                },
            });
            const expectedText = "@a changed the power level of @b from Moderator to Admin.";
            expect(textForEvent(event)).toEqual(expectedText);
        });

        it("returns correct message for a single user with power level changed to the default", () => {
            const event = mockPowerEvent({
                usersDefault: 20,
                prevDefault: 101,
                users: {
                    [userB.id]: 20,
                },
                prevUsers: {
                    [userB.id]: 50,
                },
            });
            const expectedText = "@a changed the power level of @b from Moderator to Default.";
            expect(textForEvent(event)).toEqual(expectedText);
        });

        it("returns correct message for a single user with power level changed to a custom level", () => {
            const event = mockPowerEvent({
                users: {
                    [userB.id]: -1,
                },
                prevUsers: {
                    [userB.id]: 50,
                },
            });
            const expectedText = "@a changed the power level of @b from Moderator to Custom (-1).";
            expect(textForEvent(event)).toEqual(expectedText);
        });

        it("returns correct message for a multiple power level changes", () => {
            const event = mockPowerEvent({
                users: {
                    [userB.id]: 100,
                    [userC.id]: 50,
                },
                prevUsers: {
                    [userB.id]: 50,
                    [userC.id]: 101,
                },
            });
            const expectedText =
                "@a changed the power level of @b from Moderator to Admin, @c from Custom (101) to Moderator.";
            expect(textForEvent(event)).toEqual(expectedText);
        });

        it("uses userIdentifier customisation", () => {
            (UserIdentifierCustomisations.getDisplayUserIdentifier as jest.Mock)
                .mockImplementation(userId => 'customised ' + userId);
            const event = mockPowerEvent({
                users: {
                    [userB.id]: 100,
                },
                prevUsers: {
                    [userB.id]: 50,
                },
            });
            // uses customised user id
            const expectedText = "@a changed the power level of customised @b from Moderator to Admin.";
            expect(textForEvent(event)).toEqual(expectedText);
            expect(UserIdentifierCustomisations.getDisplayUserIdentifier)
                .toHaveBeenCalledWith(userB.id, { roomId: event.getRoomId() });
        });
    });

    describe("textForCanonicalAliasEvent()", () => {
        const userA = {
            id: '@a',
            name: 'Alice',
        };

        interface AliasEventProps {
            alias?: string; prevAlias?: string; altAliases?: string[]; prevAltAliases?: string[];
        }
        const mockEvent = ({
            alias, prevAlias, altAliases, prevAltAliases,
        }: AliasEventProps): MatrixEvent => new MatrixEvent({
            type: EventType.RoomCanonicalAlias,
            sender: userA.id,
            state_key: "",
            content: {
                alias, alt_aliases: altAliases,
            },
            prev_content: {
                alias: prevAlias, alt_aliases: prevAltAliases,
            },
        });

        type TestCase = [string, AliasEventProps & { result: string }];
        const testCases: TestCase[] = [
            ["room alias didn't change", {
                result: '@a changed the addresses for this room.',
            }],
            ["room alias changed", {
                alias: 'banana',
                prevAlias: 'apple',
                result: '@a set the main address for this room to banana.',
            }],
            ["room alias was added", {
                alias: 'banana',
                result: '@a set the main address for this room to banana.',
            }],
            ["room alias was removed", {
                prevAlias: 'apple',
                result: '@a removed the main address for this room.',
            }],
            ["added an alt alias", {
                altAliases: ['canteloupe'],
                result: '@a added alternative address canteloupe for this room.',
            }],
            ["added multiple alt aliases", {
                altAliases: ['canteloupe', 'date'],
                result: '@a added the alternative addresses canteloupe, date for this room.',
            }],
            ["removed an alt alias", {
                altAliases: ['canteloupe'],
                prevAltAliases: ['canteloupe', 'date'],
                result: '@a removed alternative address date for this room.',
            }],
            ["added and removed an alt aliases", {
                altAliases: ['canteloupe', 'elderberry'],
                prevAltAliases: ['canteloupe', 'date'],
                result: '@a changed the alternative addresses for this room.',
            }],
            ["changed alias and added alt alias", {
                alias: 'banana',
                prevAlias: 'apple',
                altAliases: ['canteloupe'],
                result: '@a changed the main and alternative addresses for this room.',
            }],
        ];

        it.each(testCases)('returns correct message when %s', (_d, { result, ...eventProps }) => {
            const event = mockEvent(eventProps);
            expect(textForEvent(event)).toEqual(result);
        });
    });

    describe("textForPollStartEvent()", () => {
        let pollEvent;

        beforeEach(() => {
            pollEvent = new MatrixEvent({
                type: 'org.matrix.msc3381.poll.start',
                sender: '@a',
                content: {
                    'org.matrix.msc3381.poll.start': {
                        answers: [
                            { 'org.matrix.msc1767.text': 'option1' },
                            { 'org.matrix.msc1767.text': 'option2' },
                        ],
                        question: {
                            'body': 'Test poll name',
                            'msgtype': 'm.text',
                            'org.matrix.msc1767.text': 'Test poll name',
                        },
                    },
                },
            });
        });

        it("returns correct message for redacted poll start", () => {
            pollEvent.makeRedacted(pollEvent);

            expect(textForEvent(pollEvent)).toEqual('@a: Message deleted');
        });

        it("returns correct message for normal poll start", () => {
            expect(textForEvent(pollEvent)).toEqual('@a has started a poll - ');
        });
    });

    describe("textForMessageEvent()", () => {
        let messageEvent;

        beforeEach(() => {
            messageEvent = new MatrixEvent({
                type: 'm.room.message',
                sender: '@a',
                content: {
                    'body': 'test message',
                    'msgtype': 'm.text',
                    'org.matrix.msc1767.text': 'test message',
                },
            });
        });

        it("returns correct message for redacted message", () => {
            messageEvent.makeRedacted(messageEvent);

            expect(textForEvent(messageEvent)).toEqual('@a: Message deleted');
        });

        it("returns correct message for normal message", () => {
            expect(textForEvent(messageEvent)).toEqual('@a: test message');
        });
    });
});
