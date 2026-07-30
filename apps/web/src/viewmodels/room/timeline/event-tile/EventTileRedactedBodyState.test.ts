/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { EventType, MatrixEvent, MsgType, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { formatFullDate } from "../../../../DateUtils";
import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { getRedactedBodyViewModelProps } from "./EventTileRedactedBodyState";

describe("EventTileRedactedBodyState", () => {
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
        new MatrixEvent({
            event_id: "$message:example.com",
            type: EventType.RoomMessage,
            sender,
            room_id: room.roomId,
            content: {
                msgtype: MsgType.Text,
                body: "Message",
            },
            unsigned: {
                redacted_because: {
                    content: {},
                    event_id: "$redaction:example.com",
                    origin_server_ts: originServerTs,
                    redacts: "$message:example.com",
                    room_id: room.roomId,
                    sender: redactedBecauseSender,
                    type: EventType.RoomRedaction,
                    unsigned: {},
                },
            },
        });

    beforeEach(() => {
        client = { getRoom: vi.fn() } as unknown as MatrixClient;
        room = { roomId: "!room:example.com", getMember: vi.fn() } as unknown as Room;
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
        vi.spyOn(client, "getRoom").mockReturnValue(room);
    });

    afterEach(() => vi.restoreAllMocks());

    it("builds self-redaction text and tooltip from the event", () => {
        const event = makeRedactedEvent();

        expect(getRedactedBodyViewModelProps(event, true)).toEqual({
            text: "Message deleted",
            tooltip: _t("timeline|redacted|tooltip", {
                date: formatFullDate(new Date(Date.UTC(2022, 10, 17, 15, 58, 32)), true),
            }),
        });
    });

    it("uses the redacting member name when another user removed the message", () => {
        vi.spyOn(room, "getMember").mockReturnValue({ name: "Alice" } as any);

        expect(
            getRedactedBodyViewModelProps(
                makeRedactedEvent({ redactedBecauseSender: "@alice-redactor:example.com" }),
                false,
            ).text,
        ).toBe("Message deleted by Alice");
    });

    it("omits the tooltip when the event has no redaction timestamp", () => {
        const event = makeRedactedEvent({ originServerTs: 0 });

        expect(getRedactedBodyViewModelProps(event, false).tooltip).toBeUndefined();
    });
});
