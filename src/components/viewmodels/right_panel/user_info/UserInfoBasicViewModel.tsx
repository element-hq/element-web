/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import {
    EventType,
    type RoomMember,
    type IPowerLevelsContent,
    type Room,
    RoomStateEvent,
    type MatrixClient,
    type User,
    type MatrixEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { useTypedEventEmitter } from "../../../../hooks/useEventEmitter";
import Modal from "../../../../Modal";
import ErrorDialog from "../../../views/dialogs/ErrorDialog";
import { _t } from "../../../../languageHandler";
import { type IRoomPermissions } from "../../../views/right_panel/UserInfo";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import QuestionDialog from "../../../views/dialogs/QuestionDialog";
import DMRoomMap from "../../../../utils/DMRoomMap";

export interface UserInfoBasicState {
    // current room powerlevels
    powerLevels: IPowerLevelsContent;
    // getting user permissions in this room
    roomPermissions: IRoomPermissions;
    // numbers of operation in progress > 0
    pendingUpdateCount: number;
    // true if user is me
    isMe: boolean;
    // true if room is a DM for the user
    isRoomDMForMember: boolean;
    // Boolean to hide or show the deactivate button
    showDeactivateButton: boolean;
    // Method called when a deactivate user action is triggered
    onSynapseDeactivate: () => void;
    startUpdating: () => void;
    stopUpdating: () => void;
}

export const getPowerLevels = (room: Room): IPowerLevelsContent =>
    room?.currentState?.getStateEvents(EventType.RoomPowerLevels, "")?.getContent() || {};

export const useRoomPermissions = (cli: MatrixClient, room: Room, user: RoomMember): IRoomPermissions => {
    const [roomPermissions, setRoomPermissions] = useState<IRoomPermissions>({
        // modifyLevelMax is the max PL we can set this user to, typically min(their PL, our PL) && canSetPL
        modifyLevelMax: -1,
        canEdit: false,
        canInvite: false,
    });

    const updateRoomPermissions = useCallback(() => {
        const powerLevels = room?.currentState.getStateEvents(EventType.RoomPowerLevels, "")?.getContent();
        if (!powerLevels) return;

        const me = room.getMember(cli.getUserId() || "");
        if (!me) return;

        const them = user;
        const isMe = me.userId === them.userId;
        const canAffectUser = them.powerLevel < me.powerLevel || isMe;

        let modifyLevelMax = -1;
        if (canAffectUser) {
            const editPowerLevel = powerLevels.events?.[EventType.RoomPowerLevels] ?? powerLevels.state_default ?? 50;
            if (me.powerLevel >= editPowerLevel) {
                modifyLevelMax = me.powerLevel;
            }
        }

        setRoomPermissions({
            canInvite: me.powerLevel >= (powerLevels.invite ?? 0),
            canEdit: modifyLevelMax >= 0,
            modifyLevelMax,
        });
    }, [cli, user, room]);

    useTypedEventEmitter(cli, RoomStateEvent.Update, updateRoomPermissions);
    useEffect(() => {
        updateRoomPermissions();
        return () => {
            setRoomPermissions({
                modifyLevelMax: -1,
                canEdit: false,
                canInvite: false,
            });
        };
    }, [updateRoomPermissions]);

    return roomPermissions;
};

const useIsSynapseAdmin = (cli?: MatrixClient): boolean => {
    return useAsyncMemo(async () => (cli ? cli.isSynapseAdministrator().catch(() => false) : false), [cli], false);
};

export const useRoomPowerLevels = (cli: MatrixClient, room: Room): IPowerLevelsContent => {
    const [powerLevels, setPowerLevels] = useState<IPowerLevelsContent>(getPowerLevels(room));

    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (!room) return;
            if (ev && ev.getType() !== EventType.RoomPowerLevels) return;
            setPowerLevels(getPowerLevels(room));
        },
        [room],
    );

    useTypedEventEmitter(cli, RoomStateEvent.Events, update);
    useEffect(() => {
        update();
        return () => {
            setPowerLevels({});
        };
    }, [update]);
    return powerLevels;
};

export const useUserInfoBasicViewModel = (room: Room, member: User | RoomMember): UserInfoBasicState => {
    const cli = useMatrixClientContext();

    const powerLevels = useRoomPowerLevels(cli, room);
    // Load whether or not we are a Synapse Admin
    const isSynapseAdmin = useIsSynapseAdmin(cli);

    // Count of how many operations are currently in progress, if > 0 then show a Spinner
    const [pendingUpdateCount, setPendingUpdateCount] = useState(0);

    const roomPermissions = useRoomPermissions(cli, room, member as RoomMember);

    // selected member is current user
    const isMe = member.userId === cli.getUserId();

    // is needed to hide the Roles section for DMs as it doesn't make sense there
    const isRoomDMForMember = !!DMRoomMap.shared().getUserIdForRoomId((member as RoomMember).roomId);

    // used to check if user can deactivate another member
    const isMemberSameDomain = member.userId.endsWith(`:${cli.getDomain()}`);

    // We don't need a perfect check here, just something to pass as "probably not our homeserver". If
    // someone does figure out how to bypass this check the worst that happens is an error.
    const showDeactivateButton = isSynapseAdmin && isMemberSameDomain;

    const startUpdating = useCallback(() => {
        setPendingUpdateCount(pendingUpdateCount + 1);
    }, [pendingUpdateCount]);

    const stopUpdating = useCallback(() => {
        setPendingUpdateCount(pendingUpdateCount - 1);
    }, [pendingUpdateCount]);

    const onSynapseDeactivate = useCallback(async () => {
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("user_info|deactivate_confirm_title"),
            description: <div>{_t("user_info|deactivate_confirm_description")}</div>,
            button: _t("user_info|deactivate_confirm_action"),
            danger: true,
        });

        const [accepted] = await finished;
        if (!accepted) return;
        try {
            await cli.deactivateSynapseUser(member.userId);
        } catch (err) {
            logger.error("Failed to deactivate user");
            logger.error(err);

            const description = err instanceof Error ? err.message : _t("invite|failed_generic");

            Modal.createDialog(ErrorDialog, {
                title: _t("user_info|error_deactivate"),
                description,
            });
        }
    }, [cli, member.userId]);

    return {
        showDeactivateButton,
        powerLevels,
        roomPermissions,
        pendingUpdateCount,
        isMe,
        isRoomDMForMember,
        onSynapseDeactivate,
        startUpdating,
        stopUpdating,
    };
};
