/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import ExternalLinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import { Button, IconButton, Tooltip } from "@vector-im/compound-web";
import React, { useCallback } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { EventType, JoinRule, type Room } from "matrix-js-sdk/src/matrix";

import Modal from "../../../../Modal";
import { ShareDialog } from "../../dialogs/ShareDialog";
import { _t } from "../../../../languageHandler";
import SettingsStore from "../../../../settings/SettingsStore";
import { calculateRoomVia } from "../../../../utils/permalinks/Permalinks";
import BaseDialog from "../../dialogs/BaseDialog";
import { useGuestAccessInformation } from "../../../../hooks/room/useGuestAccessInformation";

/**
 * Display a button to open a dialog to share a link to the call using a element call guest spa url (`element_call:guest_spa_url` in the EW config).
 * @param room
 * @returns Nothing if there is not the option to share a link (No guest_spa_url is set) or a button to open a dialog to share the link.
 */
export const CallGuestLinkButton: React.FC<{ room: Room }> = ({ room }) => {
    const { canInviteGuests, guestSpaUrl, isRoomJoinable, canInvite } = useGuestAccessInformation(room);

    const generateCallLink = useCallback(() => {
        if (!isRoomJoinable()) throw new Error("Cannot create link for room that users can not join without invite.");
        if (!guestSpaUrl) throw new Error("No guest SPA url for external links provided.");
        const url = new URL(guestSpaUrl);
        url.pathname = "/room/";
        // Set params for the sharable url
        url.searchParams.set("roomId", room.roomId);
        if (room.hasEncryptionStateEvent()) url.searchParams.set("perParticipantE2EE", "true");
        for (const server of calculateRoomVia(room)) {
            url.searchParams.set("viaServers", server);
        }

        // Move params into hash
        url.hash = "/" + room.name + url.search;
        url.search = "";

        logger.info("Generated element call external url:", url);
        return url;
    }, [guestSpaUrl, isRoomJoinable, room]);

    const showLinkModal = useCallback(() => {
        try {
            // generateCallLink throws if the invite rules are not met
            const target = generateCallLink();
            Modal.createDialog(ShareDialog, {
                target,
                customTitle: _t("share|share_call"),
                subtitle: _t("share|share_call_subtitle"),
            });
        } catch (e) {
            logger.error("Could not generate call link.", e);
        }
    }, [generateCallLink]);

    const shareClick = useCallback(() => {
        if (isRoomJoinable()) {
            showLinkModal();
        } else {
            // the room needs to be set to public or knock to generate a link
            Modal.createDialog(JoinRuleDialog, {
                room,
                // If the user cannot invite the Knocking is not given as an option.
                canInvite,
            }).finished.then(() => {
                if (isRoomJoinable()) showLinkModal();
            });
        }
    }, [isRoomJoinable, showLinkModal, room, canInvite]);

    return (
        <>
            {canInviteGuests && (
                <Tooltip label={_t("voip|get_call_link")}>
                    <IconButton onClick={shareClick}>
                        <ExternalLinkIcon />
                    </IconButton>
                </Tooltip>
            )}
        </>
    );
};

/**
 * A dialog to change the join rule of a room to public or knock.
 * @param room The room to change the join rule of.
 * @param onFinished Callback that is getting called if the dialog wants to close.
 */
export const JoinRuleDialog: React.FC<{
    onFinished(): void;
    room: Room;
    canInvite: boolean;
}> = ({ onFinished, room, canInvite }) => {
    const askToJoinEnabled = SettingsStore.getValue("feature_ask_to_join");
    const [isUpdating, setIsUpdating] = React.useState<undefined | JoinRule>(undefined);
    const changeJoinRule = useCallback(
        async (newRule: JoinRule) => {
            if (isUpdating !== undefined) return;
            setIsUpdating(newRule);
            await room.client.sendStateEvent(
                room.roomId,
                EventType.RoomJoinRules,
                {
                    join_rule: newRule,
                },
                "",
            );
            // Show the dialog for a bit to give the user feedback
            setTimeout(() => onFinished(), 500);
        },
        [isUpdating, onFinished, room.client, room.roomId],
    );
    return (
        <BaseDialog title={_t("update_room_access_modal|title")} onFinished={onFinished} className="mx_JoinRuleDialog">
            <p>{_t("update_room_access_modal|description")}</p>
            <div className="mx_JoinRuleDialogButtons">
                {askToJoinEnabled && canInvite && (
                    <Button
                        kind="secondary"
                        className="mx_Dialog_nonDialogButton"
                        disabled={isUpdating === JoinRule.Knock}
                        onClick={() => changeJoinRule(JoinRule.Knock)}
                    >
                        {_t("action|ask_to_join")}
                    </Button>
                )}
                <Button
                    className="mx_Dialog_nonDialogButton"
                    kind="destructive"
                    disabled={isUpdating === JoinRule.Public}
                    onClick={() => changeJoinRule(JoinRule.Public)}
                >
                    {_t("common|public")}
                </Button>
            </div>
            <p>{_t("update_room_access_modal|dont_change_description")}</p>
            <div className="mx_JoinRuleDialogButtons">
                <Button
                    kind="tertiary"
                    className="mx_Dialog_nonDialogButton"
                    onClick={() => {
                        if (isUpdating === undefined) onFinished();
                    }}
                >
                    {_t("update_room_access_modal|no_change")}
                </Button>
            </div>
        </BaseDialog>
    );
};
