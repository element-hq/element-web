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

describe("TextForPinnedEvent - newly pinned message(s)", () => {
    SettingsStore.setValue("feature_pinning", null, SettingLevel.DEVICE, true);

    it("mentions message when a single message was pinned, with no previously pinned messages", () => {
        const event = mockPinnedEvent(['message-1']);
        expect(textForEvent(event)).toBe("@foo:example.com pinned a message to this room. See all pinned messages.");
    });

    it("mentions message when a single message was pinned, with multiple previously pinned messages", () => {
        const event = mockPinnedEvent(['message-3'], ['message-1', 'message-2']);
        expect(textForEvent(event)).toBe("@foo:example.com pinned a message to this room. See all pinned messages.");
    });

    it("shows generic text when multiple messages were pinned", () => {
        const event = mockPinnedEvent(['message-2', 'message-3'], ['message-1']);
        expect(textForEvent(event)).toBe("@foo:example.com changed the pinned messages for the room.");
    });
});

describe("TextForPinnedEvent - newly pinned message(s) (JSX)", () => {
    SettingsStore.setValue("feature_pinning", null, SettingLevel.DEVICE, true);

    it("mentions message when a single message was pinned, with no previously pinned messages", () => {
        const event = mockPinnedEvent(['message-1']);
        const component = renderer.create(textForEvent(event, true));
        expect(component.toJSON()).toMatchSnapshot();
    });

    it("mentions message when a single message was pinned, with multiple previously pinned messages", () => {
        const event = mockPinnedEvent(['message-3'], ['message-1', 'message-2']);
        const component = renderer.create(textForEvent(event, true));
        expect(component.toJSON()).toMatchSnapshot();
    });

    it("shows generic text when multiple messages were pinned", () => {
        const event = mockPinnedEvent(['message-2', 'message-3'], ['message-1']);
        const component = renderer.create(textForEvent(event, true));
        expect(component.toJSON()).toMatchSnapshot();
    });
});
