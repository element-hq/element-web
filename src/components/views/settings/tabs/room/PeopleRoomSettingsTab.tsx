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

import { EventTimeline, MatrixError, Room, RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import React, { useCallback, useState, VFC } from "react";

import { Icon as CheckIcon } from "../../../../../../res/img/feather-customised/check.svg";
import { Icon as XIcon } from "../../../../../../res/img/feather-customised/x.svg";
import { formatRelativeTime } from "../../../../../DateUtils";
import { useTypedEventEmitterState } from "../../../../../hooks/useEventEmitter";
import { _t } from "../../../../../languageHandler";
import Modal, { IHandle } from "../../../../../Modal";
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
                    {seeMore ? _t("See less") : _t("See more")}
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
                <XIcon width={18} height={18} />
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
        useCallback(() => room.getMembersWithMembership("knock"), [room]),
    );

    return (
        <SettingsTab>
            <SettingsSection heading={_t("common|people")}>
                <SettingsFieldset legend={_t("Asking to join")}>
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
                        <p className="mx_PeopleRoomSettingsTab_paragraph">{_t("No requests")}</p>
                    )}
                </SettingsFieldset>
            </SettingsSection>
        </SettingsTab>
    );
};
