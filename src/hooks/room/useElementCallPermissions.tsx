/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, JoinRule, RoomState, type Room } from "matrix-js-sdk/src/matrix";
import { useCallback } from "react";

import { useFeatureEnabled } from "../useSettings";
import { useRoomState } from "../useRoomState";
import { _t } from "../../languageHandler";
import { ElementCallEventType, ElementCallMemberEventType } from "../../call-types";
import { LocalRoom } from "../../models/LocalRoom";
import { RoomPowerLevelsEventContent } from "matrix-js-sdk/src/types";
import {
    DefaultCallApplicationDescription,
    DefaultCallApplicationSlot,
    MatrixRTCSession,
} from "matrix-js-sdk/src/matrixrtc";
import { slotDescriptionToId } from "matrix-js-sdk/src/matrixrtc";

export enum ElementCallPromptAction {
    /**
     * Do not allow calls to be started without permission being set.
     */
    NoPrompt,
    /**
     * Prompt before allowing a call to be started.
     */
    Prompt,
    /**
     * Do not prompt, just configure permissions automatically.
     */
    AutoAllow,
}

type ElementCallPermissions = {
    canStartCall: boolean;
    canAdjustCallPermissions: boolean;
    permissionsPromptAction: ElementCallPromptAction;
    enableCallInRoom(): Promise<void>;
    disableCallInRoom(): Promise<void>;
};

/**
 * Hook for adjusting permissions for enabling Element Call.
 * This uses the legacy state controlled system.
 * @param room the room to track
 */
function useLegacyCallPermissions(room: Room | LocalRoom): ElementCallPermissions {
    const [powerLevelContent, maySend, elementCallEnabled] = useRoomState(
        room,
        useCallback(
            (state: RoomState) => {
                const content = state
                    ?.getStateEvents(EventType.RoomPowerLevels, "")
                    ?.getContent<RoomPowerLevelsEventContent>();
                return [
                    content ?? {},
                    state?.maySendStateEvent(EventType.RoomPowerLevels, room.client.getSafeUserId()),
                    content?.events?.[ElementCallMemberEventType.name] === 0,
                ] as const;
            },
            [room.client],
        ),
    );

    const enableCallInRoom = useCallback(async () => {
        const newContent = { events: {}, ...powerLevelContent };
        const userLevel = newContent.events[EventType.RoomMessage] ?? powerLevelContent.users_default ?? 0;
        const moderatorLevel = powerLevelContent.kick ?? 50;
        const isPublic = room.getJoinRule() === JoinRule.Public;
        newContent.events[ElementCallEventType.name] = isPublic ? moderatorLevel : userLevel;
        newContent.events[ElementCallMemberEventType.name] = userLevel;
        await room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, newContent);
    }, [room, powerLevelContent]);

    const disableCallInRoom = useCallback(async () => {
        const newContent = { events: {}, ...powerLevelContent };
        const adminLevel = newContent.events[EventType.RoomPowerLevels] ?? powerLevelContent.state_default ?? 100;
        newContent.events[ElementCallEventType.name] = adminLevel;
        newContent.events[ElementCallMemberEventType.name] = adminLevel;
        await room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, newContent);
    }, [room, powerLevelContent]);

    return {
        canStartCall: elementCallEnabled,
        canAdjustCallPermissions: maySend,
        permissionsPromptAction: ElementCallPromptAction.NoPrompt,
        enableCallInRoom,
        disableCallInRoom,
    };
}

/**
 * Hook for adjusting permissions for enabling Element Call.
 * This requires MSC4354 (Sticky events) to work.
 * @param room the room to track
 */
const useSlotsCallPermissions = (room: Room | LocalRoom): ElementCallPermissions => {
    const slotId = slotDescriptionToId(DefaultCallApplicationDescription);
    const [maySendSlot, hasRoomSlot, canEveryoneAdjustPermissions] = useRoomState(room, () => [
        room.currentState.mayClientSendStateEvent(EventType.RTCSlot, room.client),
        // TODO: Replace with proper const
        MatrixRTCSession.getRtcSlot(room, DefaultCallApplicationDescription) !== null,
        !room.getJoinedMembers().some((v) => !room.currentState.maySendStateEvent(EventType.RTCSlot, v.userId)),
    ]);

    // TODO: Check that we are allowed to create audio/video calls, when the telephony PR lands.
    const createElementCallSlot = useCallback(async (): Promise<void> => {
        await room.client.sendStateEvent(
            room.roomId,
            "org.matrix.msc4143.rtc.slot",
            {
                application: DefaultCallApplicationSlot.application,
            },
            slotId,
        );
    }, [room, hasRoomSlot]);

    const removeElementCallSlot = useCallback(async (): Promise<void> => {
        await room.client.sendStateEvent(room.roomId, "org.matrix.msc4143.rtc.slot", {}, slotId);
    }, [room]);

    return {
        canStartCall: hasRoomSlot,
        canAdjustCallPermissions: maySendSlot,
        permissionsPromptAction: canEveryoneAdjustPermissions
            ? ElementCallPromptAction.AutoAllow
            : ElementCallPromptAction.Prompt,
        enableCallInRoom: createElementCallSlot,
        disableCallInRoom: removeElementCallSlot,
    };
};

/**
 * Get and set whether an Element Call session may take place. If MSC4354 is enabled,
 * this will use the new slots flow. Otherwise, this will fallback to the older state-based permissions.
 * @param room
 * @returns
 */
export function useElementCallPermissions(room: Room | LocalRoom): ElementCallPermissions {
    // We load both, to avoid conditional hook rendering on settings change.
    const slotsPerms = useSlotsCallPermissions(room);
    const legacyPerms = useLegacyCallPermissions(room);
    const isMSC4354Enabled = useFeatureEnabled("feature_element_call_nextgen");
    return isMSC4354Enabled ? slotsPerms : legacyPerms;
}
