/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, JoinRule, RoomState, type Room } from "matrix-js-sdk/src/matrix";
import { useCallback } from "react";

import type React from "react";
import { useFeatureEnabled } from "../useSettings";
import { useRoomState } from "../useRoomState";
import { _t } from "../../languageHandler";
import { ElementCallEventType, ElementCallMemberEventType } from "../../call-types";
import { LocalRoom } from "../../models/LocalRoom";
import QuestionDialog from "../../components/views/dialogs/QuestionDialog";
import Modal from "../../Modal";
import { RoomPowerLevelsEventContent } from "matrix-js-sdk/src/types";

type ElementCallPermissions = {
    canStartCall: boolean;
    canAdjustCallPermissions: boolean;
    enableCallInRoom(): void;
    disableCallInRoom(): void;
} 


/**
 * Hook for adjusting permissions for enabling Element Call.
 * This uses the legacy state controlled system.
 * @param room the room to track
 */
function useLegacyCallPermissions(room: Room| LocalRoom): ElementCallPermissions {
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
                    content?.events?.[ElementCallMemberEventType.name] === 0
                ] as const;
            },
            [room.client],
        ),
    );

    const enableCallInRoom = useCallback(() => {
        console.log('Enabling call');
        const newContent = { events: {}, ...powerLevelContent };
        const userLevel = newContent.events[EventType.RoomMessage] ?? powerLevelContent.users_default ?? 0;
        const moderatorLevel = powerLevelContent.kick ?? 50;
        const isPublic = room.getJoinRule() === JoinRule.Public;
        console.log(newContent.events);
        newContent.events[ElementCallEventType.name] = isPublic ? moderatorLevel : userLevel;
        newContent.events[ElementCallMemberEventType.name] = userLevel;
        room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, newContent);
    },[room, powerLevelContent]);


    const disableCallInRoom = useCallback(() => {
        console.log('Disabling call');
        const newContent = { events: {}, ...powerLevelContent };
        const adminLevel = newContent.events[EventType.RoomPowerLevels] ?? powerLevelContent.state_default ?? 100;
        newContent.events[ElementCallEventType.name] = adminLevel;
        newContent.events[ElementCallMemberEventType.name] = adminLevel;
        room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, newContent);
    },[room, powerLevelContent]);

    return {
        canStartCall: elementCallEnabled,
        canAdjustCallPermissions: maySend,
        enableCallInRoom,
        disableCallInRoom,
    };
}

/**
 * Hook for adjusting permissions for enabling Element Call.
 * This requires MSC4354 (Sticky events) to work.
 * @param room the room to track
 */
const useSlotsCallPermissions = (
    room: Room | LocalRoom,
): ElementCallPermissions => {
    const [maySendSlot, hasRoomSlot] = useRoomState(room, () => [
        room.currentState.mayClientSendStateEvent("org.matrix.msc4143.rtc.slot", room.client),
        // TODO: Replace with proper const
        room.currentState.getStateEvents("org.matrix.msc4143.rtc.slot", "m.call#ROOM")?.getContent()?.application?.type === 'm.call',
    ]);

    // TODO: Check that we are allowed to create audio/video calls, when the telephony PR lands.
    const createElementCallSlot = useCallback(async (): Promise<boolean> => {
        console.log('createElementCallSlot', { hasRoomSlot });
        if (hasRoomSlot) {
            return true;
        }
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: "Do you want to allow calls in this room?",
            description: (
                <p>
                    This room doesn't currently permit calling. If you continue, other users will
                    be able to place calls in the future. You may turn this off in the Room Settings.
                </p>
            ),
            button: _t("action|continue"),
        });
        const [confirmed] = await finished;
        if (!confirmed) {
            return false;
        }
        await room.client.sendStateEvent(room.roomId, "org.matrix.msc4143.rtc.slot", {
            "application": {
                "type": "m.call",
                // 
                "m.call.id": "i_dont_know_what_this_should_be",
            }
        }, "m.call#ROOM");
        return true;
    }, [room, hasRoomSlot]);

    const removeElementCallSlot = useCallback(async (): Promise<void> => {
        console.log('removeElementCallSlot', { hasRoomSlot });
        if (hasRoomSlot) {
            await room.client.sendStateEvent(room.roomId, "org.matrix.msc4143.rtc.slot", { }, "m.call#ROOM");
        }
    }, [room, hasRoomSlot]);


    return {
        canStartCall: hasRoomSlot,
        canAdjustCallPermissions: maySendSlot,
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
export function useElementCallPermissions (room: Room | LocalRoom): ElementCallPermissions {
    // We load both, to avoid conditional hook rendering on settings change.
    const slotsPerms = useSlotsCallPermissions(room);
    const legacyPerms = useLegacyCallPermissions(room);
    const isMSC4354Enabled = useFeatureEnabled("feature_element_call_msc4354");
    return isMSC4354Enabled ? slotsPerms : legacyPerms;
}