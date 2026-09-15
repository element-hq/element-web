/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { RTC_SLOT_ENCRYPTION_PER_MEMBER, type RtcSlotEncryptionContent } from "matrix-js-sdk/src/matrixrtc";

import { _t } from "../../languageHandler";
import SettingsStore from "../../settings/SettingsStore";
import { logErrorAndShowErrorDialog } from "../ErrorUtils";

const assertSlotsEnabled = (): void => {
    if (!SettingsStore.getValue("feature_matrixrtc_slots")) {
        throw new Error("MatrixRTC slots are not enabled");
    }
};

/**
 * Determines the encryption to declare on the room's MatrixRTC slot: per-member encryption if the room
 * is encrypted and per-sender call encryption hasn't been disabled, otherwise none.
 */
const getSlotEncryption = (room: Room): RtcSlotEncryptionContent | undefined => {
    const usesPerMemberEncryption =
        room.hasEncryptionStateEvent() && !SettingsStore.getValue("feature_disable_call_per_sender_encryption");
    return usesPerMemberEncryption ? { type: RTC_SLOT_ENCRYPTION_PER_MEMBER } : undefined;
};

/**
 * Ensures the room's MatrixRTC slot is open, sending a state event to open (or create) it if needed.
 * No-op if the slot is already open with the expected application and encryption.
 * If opening the slot failed, an error dialog is displayed.
 * @returns true if the slot is open (or no action was needed), false if opening it failed.
 * @throws if the `feature_matrixrtc_slots` labs flag is off.
 */
export const ensureSlotOpen = async (room: Room): Promise<boolean> => {
    assertSlotsEnabled();
    try {
        await room.client.matrixRTC.getRoomSession(room).ensureRtcSlotOpen({ encryption: getSlotEncryption(room) });
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
 * @throws if the `feature_matrixrtc_slots` labs flag is off.
 */
export const ensureSlotClosed = async (room: Room): Promise<boolean> => {
    assertSlotsEnabled();
    try {
        await room.client.matrixRTC.getRoomSession(room).ensureRtcSlotClosed();
        return true;
    } catch (e) {
        logErrorAndShowErrorDialog(_t("voip|close_slot_failed_title"), e);
        return false;
    }
};
