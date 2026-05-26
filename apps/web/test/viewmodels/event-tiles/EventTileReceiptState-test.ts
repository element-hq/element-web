/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, EventType, M_POLL_END, M_POLL_START, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import {
    getEventTileReceiptState,
    isEligibleForSpecialReceipt,
    type EventTileReceiptStateInput,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileReceiptState";

const roomId = "!room:example.org";
const ownUserId = "@alice:example.org";
const otherUserId = "@bob:example.org";

function makeEvent({
    type = EventType.RoomMessage,
    user = ownUserId,
}: {
    type?: string;
    user?: string;
} = {}): MatrixEvent {
    return mkEvent({
        event: true,
        type,
        room: roomId,
        user,
        content: {
            msgtype: MsgType.Text,
            body: "Hello",
        },
    });
}

function makeInput(overrides: Partial<EventTileReceiptStateInput> = {}): EventTileReceiptStateInput {
    return {
        mxEvent: makeEvent(),
        hasRoom: true,
        ownUserId,
        lastSuccessful: true,
        timelineRenderingType: TimelineRenderingType.Room,
        ...overrides,
    };
}

describe("EventTileReceiptState", () => {
    it.each([
        EventType.RoomMessage,
        EventType.RoomMessageEncrypted,
        EventType.Sticker,
        M_POLL_START.name,
        M_POLL_END.name,
    ])("treats %s as eligible for special receipts", (type) => {
        expect(isEligibleForSpecialReceipt(makeEvent({ type }))).toBe(true);
    });

    it("does not treat state events as eligible for special receipts", () => {
        expect(isEligibleForSpecialReceipt(makeEvent({ type: EventType.RoomName }))).toBe(false);
    });

    it("shows a sent receipt for the last successful own event", () => {
        const state = getEventTileReceiptState(makeInput());

        expect(state).toMatchObject({
            isEligibleForSpecialReceipt: true,
            shouldShowSentReceipt: true,
            shouldShowSendingReceipt: false,
            shouldListenForReceipts: true,
        });
    });

    it("shows a sent receipt for an explicitly sent event", () => {
        const state = getEventTileReceiptState(makeInput({ eventSendStatus: EventStatus.SENT }));

        expect(state.shouldShowSentReceipt).toBe(true);
        expect(state.shouldListenForReceipts).toBe(true);
    });

    it("shows a sending receipt for pending send states", () => {
        for (const eventSendStatus of [EventStatus.QUEUED, EventStatus.SENDING, EventStatus.ENCRYPTING]) {
            const state = getEventTileReceiptState(makeInput({ eventSendStatus }));

            expect(state.shouldShowSentReceipt).toBe(false);
            expect(state.shouldShowSendingReceipt).toBe(true);
            expect(state.shouldListenForReceipts).toBe(true);
        }
    });

    it("does not show a sent receipt in the thread list", () => {
        const state = getEventTileReceiptState(
            makeInput({
                timelineRenderingType: TimelineRenderingType.ThreadsList,
            }),
        );

        expect(state.shouldShowSentReceipt).toBe(false);
        expect(state.shouldListenForReceipts).toBe(false);
    });

    it("does not show special receipts once read receipts are present", () => {
        const state = getEventTileReceiptState(
            makeInput({
                readReceipts: [
                    {
                        userId: otherUserId,
                    },
                ],
            }),
        );

        expect(state.isEligibleForSpecialReceipt).toBe(false);
        expect(state.shouldShowSentReceipt).toBe(false);
        expect(state.shouldShowSendingReceipt).toBe(false);
        expect(state.shouldListenForReceipts).toBe(false);
    });

    it("does not show special receipts for another sender", () => {
        const state = getEventTileReceiptState(
            makeInput({
                mxEvent: makeEvent({ user: otherUserId }),
            }),
        );

        expect(state.isEligibleForSpecialReceipt).toBe(false);
        expect(state.shouldListenForReceipts).toBe(false);
    });

    it("does not show special receipts when the room is not available", () => {
        const state = getEventTileReceiptState(makeInput({ hasRoom: false }));

        expect(state.isEligibleForSpecialReceipt).toBe(false);
        expect(state.shouldListenForReceipts).toBe(false);
    });
});
