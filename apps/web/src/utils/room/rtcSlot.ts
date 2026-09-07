/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type Room } from "matrix-js-sdk/src/matrix";
import { type MatrixRTCSession, RTC_SLOT_ENCRYPTION_PER_MEMBER } from "matrix-js-sdk/src/matrixrtc";

import { _t } from "../../languageHandler";
import SettingsStore from "../../settings/SettingsStore";
import { logErrorAndShowErrorDialog } from "../ErrorUtils";

const assertSlotsEnabled = (): void => {
    if (!SettingsStore.getValue("feature_matrixrtc_slots")) {
        throw new Error("MatrixRTC slots are not enabled");
    }
};

function assertSlotId(session: MatrixRTCSession): asserts session is MatrixRTCSession & { slotId: string } {
    if (!session.slotId) {
        // The property allows undefined for historical reasons only.
        throw new Error("No slot ID has been associated with this session");
    }
}

/**
 * Ensures the room's MatrixRTC slot is open, sending a state event to open (or create) it if needed.
 * No-op if the slot is already open.
 * If opening the slot failed, an error dialog is displayed.
 * @returns true if the slot is open (or no action was needed), false if opening it failed.
 * @throws if the `feature_matrixrtc_slots` labs flag is off or the session has no slot ID.
 */
export const ensureSlotOpen = async (room: Room): Promise<boolean> => {
    assertSlotsEnabled();
    const session = room.client.matrixRTC.getRoomSession(room);
    assertSlotId(session);
    const existingContent = session.getRtcSlot();
    if (existingContent?.status === "open") return true;
    const usesPerMemberEncryption =
        room.hasEncryptionStateEvent() && !SettingsStore.getValue("feature_disable_call_per_sender_encryption");
    try {
        await room.client.sendStateEvent(
            room.roomId,
            EventType.RTCSlot,
            {
                ...existingContent,
                status: "open",
                application: existingContent?.application ?? { type: session.slotDescription.application },
                encryption:
                    existingContent?.encryption ??
                    (usesPerMemberEncryption ? { type: RTC_SLOT_ENCRYPTION_PER_MEMBER } : undefined),
            },
            session.slotId,
        );
        return true;
    } catch (e) {
        logErrorAndShowErrorDialog(_t("voip|open_slot_failed_title"), e);
        return false;
    }
};

/**
 * Ensures the room's MatrixRTC slot is closed, sending a state event to close it if needed.
 * No-op if the slot is already closed or doesn't exist.
 * If closing the slot failed, an error dialog is displayed.
 * @returns true if the slot is closed (or no action was needed), false if closing it failed.
 * @throws if the `feature_matrixrtc_slots` labs flag is off or the session has no slot ID.
 */
export const ensureSlotClosed = async (room: Room): Promise<boolean> => {
    assertSlotsEnabled();
    const session = room.client.matrixRTC.getRoomSession(room);
    assertSlotId(session);
    const existingContent = session.getRtcSlot();
    if (!existingContent || existingContent.status === "closed") return true;
    try {
        await room.client.sendStateEvent(
            room.roomId,
            EventType.RTCSlot,
            {
                ...existingContent,
                status: "closed",
            },
            session.slotId,
        );
        return true;
    } catch (e) {
        logErrorAndShowErrorDialog(_t("voip|close_slot_failed_title"), e);
        return false;
    }
};
