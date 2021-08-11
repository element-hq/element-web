import './skinned-sdk';

import { textForEvent } from "../src/TextForEvent";
import { MatrixEvent } from "matrix-js-sdk";
import SettingsStore from "../src/settings/SettingsStore";
import { SettingLevel } from "../src/settings/SettingLevel";
import renderer from 'react-test-renderer';

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
    describe("TextForPinnedEvent", () => {
        SettingsStore.setValue("feature_pinning", null, SettingLevel.DEVICE, true);

        it("mentions message when a single message was pinned, with no previously pinned messages", () => {
            const event = mockPinnedEvent(['message-1']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com pinned a message to this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("mentions message when a single message was pinned, with multiple previously pinned messages", () => {
            const event = mockPinnedEvent(['message-1', 'message-2', 'message-3'], ['message-1', 'message-2']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com pinned a message to this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("mentions message when a single message was unpinned, with a single message previously pinned", () => {
            const event = mockPinnedEvent([], ['message-1']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com unpinned a message from this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("mentions message when a single message was unpinned, with multiple previously pinned messages", () => {
            const event = mockPinnedEvent(['message-2'], ['message-1', 'message-2']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com unpinned a message from this room. See all pinned messages.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("shows generic text when multiple messages were pinned", () => {
            const event = mockPinnedEvent(['message-1', 'message-2', 'message-3'], ['message-1']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("shows generic text when multiple messages were unpinned", () => {
            const event = mockPinnedEvent(['message-3'], ['message-1', 'message-2', 'message-3']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });

        it("shows generic text when one message was pinned, and another unpinned", () => {
            const event = mockPinnedEvent(['message-2'], ['message-1']);
            const plainText = textForEvent(event);
            const component = renderer.create(textForEvent(event, true));

            const expectedText = "@foo:example.com changed the pinned messages for the room.";
            expect(plainText).toBe(expectedText);
            expect(renderComponent(component)).toBe(expectedText);
        });
    });
});
