/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { useCallback, useMemo } from "react";

import type React from "react";
import { useFeatureEnabled } from "../useSettings";
import { useRoomState } from "../useRoomState";
import { _t } from "../../languageHandler";
import { ElementCallMemberEventType } from "../../call-types";
import { LocalRoom } from "../../models/LocalRoom";
import QuestionDialog from "../../components/views/dialogs/QuestionDialog";
import Modal from "../../Modal";


const useLegacyCallPermissions = (room: Room | LocalRoom): ReturnType<typeof useElementCallPermissions> {

}

/**
 * Hook for adjusting permissions for enabling Element Call.
 * @param room the room to track
 * @returns the call button attributes for the given room
 */
const useSlotsCallPermissions = (
    room: Room | LocalRoom,
): {
    canStartCall: boolean;
    canAdjustCallPermissions: boolean;
    enableCallInRoom(): void;
    disableCallInRoom(): void;
} => {
    // Use sticky events 
    const isMSC4354Enabled = useFeatureEnabled("feature_element_call_msc4354");
    const [mayCreateElementCallState, maySendSlot, hasRoomSlot, isPublic] = useRoomState<[boolean, boolean, boolean, boolean, boolean]>(room, () => [
        room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
        room.currentState.mayClientSendStateEvent(ElementCallMemberEventType.name, room.client),
        room.currentState.mayClientSendStateEvent("org.matrix.msc4143.rtc.slot", room.client),
        // TODO: Replace with proper const
        room.currentState.getStateEvents("org.matrix.msc4143.rtc.slot", "m.call#ROOM")?.getContent()?.application?.type === 'm.call',
        room.getJoinRule() === JoinRule.Public,
    ]);

    // TODO: Check that we are allowed to create audio/video calls, when the telephony PR lands.
    const hasElementCallSlot = !isMSC4354Enabled || hasRoomSlot;

    const mayCreateElementCalls = useMemo(() => {
        if (isMSC4354Enabled) {
            return hasElementCallSlot || maySendSlot 
        }
        return mayCreateElementCallState;
    }, [isMSC4354Enabled, mayCreateElementCallState, maySendSlot, hasElementCallSlot]);

    const createElementCallSlot = useCallback(async (): Promise<boolean> => {
        if (hasElementCallSlot) {
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
    }, [room, hasElementCallSlot]);

    const removeElementCallSlot = useCallback(async (): Promise<void> => {
        if (hasElementCallSlot) {
            await room.client.sendStateEvent(room.roomId, "org.matrix.msc4143.rtc.slot", { }, "m.call#ROOM");
        }
    }, [room, hasElementCallSlot]);


    return {
        canStartCall: mayCreateElementCalls,
        canAdjustCallPermissions: maySendSlot,
        enableCallInRoom: createElementCallSlot,
        disableCallInRoom: removeElementCallSlot,
    };
};

const useLegacyCallPermissions = (room: Room | LocalRoom): ReturnType<typeof useElementCallPermissions> {

}