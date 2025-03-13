/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventTimeline, type MatrixError, type Room, type RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import React, { useCallback, useState, type VFC } from "react";
import { CloseIcon, CheckIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { formatRelativeTime } from "../../../../../DateUtils";
import { useTypedEventEmitterState } from "../../../../../hooks/useEventEmitter";
import { _t } from "../../../../../languageHandler";
import Modal, { type IHandle } from "../../../../../Modal";
import MemberAvatar from "../../../avatars/MemberAvatar";
import ErrorDialog from "../../../dialogs/ErrorDialog";
import AccessibleButton from "../../../elements/AccessibleButton";
import SettingsFieldset from "../../SettingsFieldset";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsTab from "../SettingsTab";

const Timestamp: VFC<{ roomMember: RoomMember }> = ({ roomMember }) => {
    const timestamp = roomMember.events.member?.event.origin_server_ts;
    if (!timestamp) return null;
    return <time className="mx_PeopleRoomSettingsTab_timestamp">{formatRelativeTime(new Date(timestamp))}</time>;
};

const SeeMoreOrLess: VFC<{ roomMember: RoomMember }> = ({ roomMember }) => {
    const [seeMore, setSeeMore] = useState(false);
    const reason = roomMember.events.member?.getContent().reason;

    if (!reason) return null;

    const truncateAt = 120;
    const shouldTruncate = reason.length > truncateAt;

    return (
        <>
            <p className="mx_PeopleRoomSettingsTab_seeMoreOrLess">
                {seeMore || !shouldTruncate ? reason : `${reason.substring(0, truncateAt)}…`}
            </p>
            {shouldTruncate && (
                <AccessibleButton kind="link" onClick={() => setSeeMore(!seeMore)}>
                    {seeMore ? _t("room_settings|people|see_less") : _t("room_settings|people|see_more")}
                </AccessibleButton>
            )}
        </>
    );
};

const Knock: VFC<{
    canInvite: boolean;
    canKick: boolean;
    onApprove: (userId: string) => Promise<void>;
    onDeny: (userId: string) => Promise<void>;
    roomMember: RoomMember;
}> = ({ canKick, canInvite, onApprove, onDeny, roomMember }) => {
    const [disabled, setDisabled] = useState(false);

    const handleApprove = (userId: string): void => {
        setDisabled(true);
        onApprove(userId).catch(onError);
    };

    const handleDeny = (userId: string): void => {
        setDisabled(true);
        onDeny(userId).catch(onError);
    };

    const onError = (): void => setDisabled(false);

    return (
        <div className="mx_PeopleRoomSettingsTab_knock">
            <MemberAvatar className="mx_PeopleRoomSettingsTab_avatar" member={roomMember} size="42px" />
            <div className="mx_PeopleRoomSettingsTab_content">
                <span className="mx_PeopleRoomSettingsTab_name">{roomMember.name}</span>
                <Timestamp roomMember={roomMember} />
                <span className="mx_PeopleRoomSettingsTab_userId">{roomMember.userId}</span>
                <SeeMoreOrLess roomMember={roomMember} />
            </div>
            <AccessibleButton
                className="mx_PeopleRoomSettingsTab_action"
                disabled={!canKick || disabled}
                kind="icon_primary_outline"
                onClick={() => handleDeny(roomMember.userId)}
                title={_t("action|deny")}
            >
                <CloseIcon width={18} height={18} />
            </AccessibleButton>
            <AccessibleButton
                className="mx_PeopleRoomSettingsTab_action"
                disabled={!canInvite || disabled}
                kind="icon_primary"
                onClick={() => handleApprove(roomMember.userId)}
                title={_t("action|approve")}
            >
                <CheckIcon width={18} height={18} />
            </AccessibleButton>
        </div>
    );
};

export const PeopleRoomSettingsTab: VFC<{ room: Room }> = ({ room }) => {
    const client = room.client;
    const userId = client.getUserId() || "";
    const canInvite = room.canInvite(userId);
    const member = room.getMember(userId);
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const canKick = member && state ? state.hasSufficientPowerLevelFor("kick", member.powerLevel) : false;
    const roomId = room.roomId;

    const handleApprove = (userId: string): Promise<void> =>
        new Promise((_, reject) =>
            client.invite(roomId, userId).catch((error) => {
                onError(error);
                reject(error);
            }),
        );

    const handleDeny = (userId: string): Promise<void> =>
        new Promise((_, reject) =>
            client.kick(roomId, userId).catch((error) => {
                onError(error);
                reject(error);
            }),
        );

    const onError = (error: MatrixError): IHandle<typeof ErrorDialog> =>
        Modal.createDialog(ErrorDialog, {
            title: error.name,
            description: error.message,
        });

    const knockMembers = useTypedEventEmitterState(
        room,
        RoomStateEvent.Update,
        useCallback(() => room.getMembersWithMembership(KnownMembership.Knock), [room]),
    );

    return (
        <SettingsTab>
            <SettingsSection heading={_t("common|people")}>
                <SettingsFieldset legend={_t("room_settings|people|knock_section")}>
                    {knockMembers.length ? (
                        knockMembers.map((knockMember) => (
                            <Knock
                                canInvite={canInvite}
                                canKick={canKick}
                                key={knockMember.userId}
                                onApprove={handleApprove}
                                onDeny={handleDeny}
                                roomMember={knockMember}
                            />
                        ))
                    ) : (
                        <p className="mx_PeopleRoomSettingsTab_paragraph">{_t("room_settings|people|knock_empty")}</p>
                    )}
                </SettingsFieldset>
            </SettingsSection>
        </SettingsTab>
    );
};
