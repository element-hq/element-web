/*
Copyright 2026 Ashram Element contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";
import { EventType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { isHreArchivedCommandRedaction } from "./shouldHideEvent";

const CURRENT_STATE_ROOM_ID = "!OWGgBUxkmnSBvCqIBO:ashram.home";
const ALERTS_ROOM_ID = "!RRmMmMOSQqNEMHrCEd:ashram.home";
const COMMANDS_ROOM_ID = "!JlrFUxRzQgmptKfCjy:ashram.home";

interface EventOptions {
    roomId?: string;
    redacted?: boolean;
    eventType?: string;
    redactionType?: string;
    redactor?: string;
    reason?: string;
}

function makeEvent({
    roomId = CURRENT_STATE_ROOM_ID,
    redacted = true,
    eventType = EventType.RoomMessage,
    redactionType = EventType.RoomRedaction,
    redactor = "@hre-bot:ashram.home",
    reason = "Archived to HRE Commands",
}: EventOptions = {}): MatrixEvent {
    return {
        isRedacted: () => redacted,
        getType: () => eventType,
        getRoomId: () => roomId,
        getUnsigned: () => ({
            redacted_because: {
                type: redactionType,
                sender: redactor,
                content: { reason },
            },
        }),
    } as unknown as MatrixEvent;
}

describe("isHreArchivedCommandRedaction", () => {
    it.each([CURRENT_STATE_ROOM_ID, ALERTS_ROOM_ID])("matches the exact HRE housekeeping redaction in %s", (roomId) => {
        expect(isHreArchivedCommandRedaction(makeEvent({ roomId }))).toBe(true);
    });

    it.each([
        ["HRE Commands room", { roomId: COMMANDS_ROOM_ID }],
        ["unrelated room", { roomId: "!elsewhere:ashram.home" }],
        ["different redactor", { redactor: "@moderator:ashram.home" }],
        ["different reason", { reason: "Ordinary moderation redaction" }],
        ["different redaction event type", { redactionType: EventType.RoomMessage }],
        ["event which is not redacted", { redacted: false }],
        ["original event which is not a room message", { eventType: EventType.Sticker }],
    ] satisfies Array<[string, EventOptions]>)("does not match %s", (_name, options) => {
        expect(isHreArchivedCommandRedaction(makeEvent(options))).toBe(false);
    });
});
