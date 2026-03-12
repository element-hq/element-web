/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MsgType, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { formatFullDate } from "../../../../../src/DateUtils";
import { _t } from "../../../../../src/languageHandler";
import { RedactedBodyViewModel } from "../../../../../src/viewmodels/message-body/RedactedBodyViewModel";
import { mkEvent, mkRoom, stubClient } from "../../../../test-utils";

describe("RedactedBodyViewModel", () => {
    let client: MatrixClient;
    let room: Room;

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
                redacted_because: {
                    sender: redactedBecauseSender,
                    origin_server_ts: originServerTs,
                },
            },
        });

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(client, "getRoom").mockReturnValue(room);
    });

    it("builds self-redaction text and tooltip from the event", () => {
        const event = makeRedactedEvent();
        const vm = new RedactedBodyViewModel({
            client,
            mxEvent: event,
            showTwelveHour: true,
        });

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

        const vm = new RedactedBodyViewModel({
            client,
            mxEvent: event,
            showTwelveHour: false,
        });

        expect(vm.getSnapshot().text).toBe("Message deleted by Alice");
    });

    it("setShowTwelveHour updates only when the value changes", () => {
        const event = makeRedactedEvent();
        const vm = new RedactedBodyViewModel({
            client,
            mxEvent: event,
            showTwelveHour: false,
        });
        const listener = jest.fn();

        vm.subscribe(listener);

        vm.setShowTwelveHour(false);
        expect(listener).not.toHaveBeenCalled();

        vm.setShowTwelveHour(true);

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
        const vm = new RedactedBodyViewModel({
            client,
            mxEvent: originalEvent,
            showTwelveHour: false,
        });
        const listener = jest.fn();

        jest.spyOn(room, "getMember").mockReturnValue({ name: "Moderator" } as any);

        vm.subscribe(listener);

        vm.setEvent(originalEvent);
        expect(listener).not.toHaveBeenCalled();

        vm.setEvent(updatedEvent);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().text).toBe("Message deleted by Moderator");
    });
});
