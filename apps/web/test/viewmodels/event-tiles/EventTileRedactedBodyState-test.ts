/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MsgType, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { formatFullDate } from "../../../src/DateUtils";
import { _t } from "../../../src/languageHandler";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { getRedactedBodyViewModelProps } from "../../../src/viewmodels/room/timeline/event-tile/EventTileRedactedBodyState";
import { mkEvent, mkRoom, stubClient } from "../../test-utils";

describe("EventTile redacted body state", () => {
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
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
        jest.spyOn(client, "getRoom").mockReturnValue(room);
    });

    afterEach(() => jest.restoreAllMocks());

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
        jest.spyOn(room, "getMember").mockReturnValue({ name: "Alice" } as any);

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
