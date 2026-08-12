/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type Room } from "matrix-js-sdk/src/matrix";
import { RTC_SLOT_ENCRYPTION_PER_MEMBER } from "matrix-js-sdk/src/matrixrtc";

import { _t } from "../../languageHandler";
import SettingsStore from "../../settings/SettingsStore";
import { logErrorAndShowErrorDialog } from "../ErrorUtils";

export const ensureSlotOpen = async (room: Room): Promise<boolean> => {
    if (!SettingsStore.getValue("feature_matrixrtc_slots")) return true;
    const session = room.client.matrixRTC.getRoomSession(room);
    if (!session.slotId) return true;
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

export const ensureSlotClosed = async (room: Room): Promise<boolean> => {
    if (!SettingsStore.getValue("feature_matrixrtc_slots")) return true;
    const session = room.client.matrixRTC.getRoomSession(room);
    if (!session.slotId) return true;
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
