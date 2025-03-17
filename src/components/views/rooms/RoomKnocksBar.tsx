/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventTimeline, JoinRule, type MatrixError, type Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import React, { type ReactElement, type ReactNode, useCallback, useState, type VFC } from "react";
import { CloseIcon, CheckIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import dis from "../../../dispatcher/dispatcher";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import MemberAvatar from "../avatars/MemberAvatar";
import ErrorDialog from "../dialogs/ErrorDialog";
import { RoomSettingsTab } from "../dialogs/RoomSettingsDialog";
import AccessibleButton from "../elements/AccessibleButton";
import Heading from "../typography/Heading";
import { formatList } from "../../../utils/FormattingUtils";

export const RoomKnocksBar: VFC<{ room: Room }> = ({ room }) => {
    const [disabled, setDisabled] = useState(false);
    const knockMembers = useTypedEventEmitterState(
        room,
        RoomStateEvent.Update,
        useCallback(() => room.getMembersWithMembership(KnownMembership.Knock), [room]),
    );
    const knockMembersCount = knockMembers.length;

    if (room.getJoinRule() !== JoinRule.Knock || knockMembersCount === 0) return null;

    const client = room.client;
    const userId = client.getUserId() || "";
    const canInvite = room.canInvite(userId);
    const member = room.getMember(userId);
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const canKick = member && state ? state.hasSufficientPowerLevelFor("kick", member.powerLevel) : false;

    if (!canInvite && !canKick) return null;

    const onError = (error: MatrixError): void => {
        Modal.createDialog(ErrorDialog, { title: error.name, description: error.message });
    };

    const handleApprove = (userId: string): void => {
        setDisabled(true);
        client
            .invite(room.roomId, userId)
            .catch(onError)
            .finally(() => setDisabled(false));
    };

    const handleDeny = (userId: string): void => {
        setDisabled(true);
        client
            .kick(room.roomId, userId)
            .catch(onError)
            .finally(() => setDisabled(false));
    };

    const handleOpenRoomSettings = (): void =>
        dis.dispatch({ action: "open_room_settings", room_id: room.roomId, initial_tab_id: RoomSettingsTab.People });

    let buttons: ReactElement = (
        <AccessibleButton
            className="mx_RoomKnocksBar_action"
            kind="primary"
            onClick={handleOpenRoomSettings}
            title={_t("action|view")}
        >
            {_t("action|view")}
        </AccessibleButton>
    );
    let names = formatList(
        knockMembers.map((knockMember) => knockMember.name),
        3,
        true,
    );
    let link: ReactNode = null;
    if (knockMembersCount === 1) {
        buttons = (
            <>
                <AccessibleButton
                    className="mx_RoomKnocksBar_action"
                    disabled={!canKick || disabled}
                    kind="icon_primary_outline"
                    onClick={() => handleDeny(knockMembers[0].userId)}
                    title={_t("action|deny")}
                >
                    <CloseIcon width={18} height={18} />
                </AccessibleButton>
                <AccessibleButton
                    className="mx_RoomKnocksBar_action"
                    disabled={!canInvite || disabled}
                    kind="icon_primary"
                    onClick={() => handleApprove(knockMembers[0].userId)}
                    title={_t("action|approve")}
                >
                    <CheckIcon width={18} height={18} />
                </AccessibleButton>
            </>
        );
        names = `${knockMembers[0].name} (${knockMembers[0].userId})`;
        link = knockMembers[0].events.member?.getContent().reason && (
            <AccessibleButton
                className="mx_RoomKnocksBar_link"
                element="a"
                kind="link_inline"
                onClick={handleOpenRoomSettings}
            >
                {_t("action|view_message")}
            </AccessibleButton>
        );
    }

    return (
        <div className="mx_RoomKnocksBar">
            {knockMembers.slice(0, 2).map((knockMember) => (
                <MemberAvatar
                    className="mx_RoomKnocksBar_avatar"
                    key={knockMember.userId}
                    member={knockMember}
                    size="32px"
                />
            ))}
            <div className="mx_RoomKnocksBar_content">
                <Heading size="4">{_t("room|header|n_people_asking_to_join", { count: knockMembersCount })}</Heading>
                <p className="mx_RoomKnocksBar_paragraph">
                    {names}
                    {link}
                </p>
            </div>
            {buttons}
        </div>
    );
};
