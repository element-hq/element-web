/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MsgType, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { formatFullDate } from "../../../../../src/DateUtils";
import { _t } from "../../../../../src/languageHandler";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { RedactedBodyViewModel } from "../../../../../src/viewmodels/message-body/RedactedBodyViewModel";
import { mkEvent, mkRoom, stubClient } from "../../../../test-utils";

describe("RedactedBodyViewModel", () => {
    let client: MatrixClient;
    let room: Room;
    let showTwelveHourSettingWatcher: ((...args: any[]) => void) | undefined;

    const makeRedactedBecauseEvent = ({ sender, originServerTs }: { sender: string; originServerTs: number }) => ({
        content: {},
        event_id: "$redaction:example.com",
        origin_server_ts: originServerTs,
        redacts: "$message:example.com",
        room_id: room.roomId,
        sender,
        type: EventType.RoomRedaction,
        unsigned: {},
    });

    const makeRedactedEvent = ({
        sender = "@alice:example.com",
        redactedBecauseSender = sender,
        originServerTs = Date.UTC(2022, 10, 17, 15, 58, 32),
    }: {
        sender?: string;
        redactedBecauseSender?: string;
        originServerTs?: number;
    } = {}): MatrixEvent =>
        mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: sender,
            room: room.roomId,
            content: {
                msgtype: MsgType.Text,
                body: "Message",
            },
            unsigned: {
                redacted_because: makeRedactedBecauseEvent({
                    sender: redactedBecauseSender,
                    originServerTs,
                }),
            },
        });

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === "showTwelveHourTimestamps");
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation((_settingName, _roomId, callbackFn) => {
            showTwelveHourSettingWatcher = callbackFn as (...args: any[]) => void;
            return "mock-show-twelve-hour-watcher";
        });
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    it("builds self-redaction text and tooltip from the event", () => {
        const event = makeRedactedEvent();
        const vm = new RedactedBodyViewModel({ mxEvent: event });

        expect(vm.getSnapshot()).toEqual({
            text: "Message deleted",
            tooltip: _t("timeline|redacted|tooltip", {
                date: formatFullDate(new Date(Date.UTC(2022, 10, 17, 15, 58, 32)), true),
            }),
        });
    });

    it("uses the redacting member name when another user removed the message", () => {
        jest.spyOn(room, "getMember").mockReturnValue({ name: "Alice" } as any);
        const event = makeRedactedEvent({
            redactedBecauseSender: "@alice-redactor:example.com",
        });

        const vm = new RedactedBodyViewModel({ mxEvent: event });

        expect(vm.getSnapshot().text).toBe("Message deleted by Alice");
    });

    it("updates the tooltip when showTwelveHourTimestamps changes", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        const event = makeRedactedEvent();
        const vm = new RedactedBodyViewModel({ mxEvent: event });
        const listener = jest.fn();

        vm.subscribe(listener);

        showTwelveHourSettingWatcher?.("showTwelveHourTimestamps", null, undefined, false, false);
        expect(listener).not.toHaveBeenCalled();

        showTwelveHourSettingWatcher?.("showTwelveHourTimestamps", null, undefined, true, true);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().tooltip).toBe(
            _t("timeline|redacted|tooltip", {
                date: formatFullDate(new Date(Date.UTC(2022, 10, 17, 15, 58, 32)), true),
            }),
        );
    });

    it("setEvent is a no-op for the same event and updates for a different event", () => {
        const originalEvent = makeRedactedEvent();
        const updatedEvent = makeRedactedEvent({
            redactedBecauseSender: "@moderator:example.com",
            originServerTs: Date.UTC(2023, 0, 1, 12, 0, 0),
        });
        const vm = new RedactedBodyViewModel({ mxEvent: originalEvent });
        const listener = jest.fn();

        jest.spyOn(room, "getMember").mockReturnValue({ name: "Moderator" } as any);

        vm.subscribe(listener);

        vm.setEvent(originalEvent);
        expect(listener).not.toHaveBeenCalled();

        vm.setEvent(updatedEvent);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().text).toBe("Message deleted by Moderator");
    });

    it("unwatches the timestamp setting when disposed", () => {
        const vm = new RedactedBodyViewModel({ mxEvent: makeRedactedEvent() });

        vm.dispose();

        expect(SettingsStore.unwatchSetting).toHaveBeenCalledWith("mock-show-twelve-hour-watcher");
    });
});
