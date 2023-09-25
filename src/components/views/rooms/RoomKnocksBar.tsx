/*
Copyright 2023 Nordeck IT + Consulting GmbH

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { EventTimeline, JoinRule, MatrixError, Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import React, { ReactElement, ReactNode, useCallback, useState, VFC } from "react";

import { Icon as CheckIcon } from "../../../../res/img/feather-customised/check.svg";
import { Icon as XIcon } from "../../../../res/img/feather-customised/x.svg";
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
        useCallback(() => room.getMembersWithMembership("knock"), [room]),
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
                    <XIcon width={18} height={18} />
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
                <Heading size="4">{_t("%(count)s people asking to join", { count: knockMembersCount })}</Heading>
                <p className="mx_RoomKnocksBar_paragraph">
                    {names}
                    {link}
                </p>
            </div>
            {buttons}
        </div>
    );
};
