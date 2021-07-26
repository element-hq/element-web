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

describe("TextForPinnedEvent", () => {
    SettingsStore.setValue("feature_pinning", null, SettingLevel.DEVICE, true);

    it("should mention sender", () => {
        const event = mockPinnedEvent();
        expect(textForEvent(event)).toBe("@foo:example.com changed the pinned messages for the room.");
    });
});

describe("TextForPinnedEvent (JSX)", () => {
    SettingsStore.setValue("feature_pinning", null, SettingLevel.DEVICE, true);

    it("should mention sender", () => {
        const event = mockPinnedEvent();
        const component = renderer.create(textForEvent(event, true));
        expect(component.toJSON()).toMatchSnapshot();
    });
});
