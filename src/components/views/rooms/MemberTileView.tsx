/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import DisambiguatedProfile from "../messages/DisambiguatedProfile";
import { RoomMember } from "../../../models/rooms/RoomMember";
import { useThreePidTileViewModel, useMemberTileViewModel } from "../../viewmodels/MemberTileViewModel";
import { E2EIconView } from "./E2EIconView";
import AvatarPresenceIconView from "./PresenceIconView";
import AccessibleButton from "../elements/AccessibleButton";
import { ThreePIDInvite } from "../../../models/rooms/ThreePIDInvite";
import BaseAvatar from "../avatars/BaseAvatar";
import { _t } from "../../../languageHandler";

interface IProps {
    member: RoomMember;
    showPresence?: boolean;
}

interface ThreePidProps {
    threePidInvite: ThreePIDInvite;
}

interface TileProps {
    avatarJsx: JSX.Element;
    nameJsx: JSX.Element | string;
    onClick: () => void;
    title?: string;
    presenceJsx?: JSX.Element;
    userLabelJsx?: JSX.Element;
    e2eIconJsx?: JSX.Element;
}

function MemberTile(props: TileProps): JSX.Element {
    return (
        // The wrapping div is required to make the magic mouse listener work, for some reason.
        <div>
            <AccessibleButton className="mx_MemberTileView" title={props.title} onClick={props.onClick}>
                <div className="mx_MemberTileView_left">
                    <div className="mx_MemberTileView_avatar">
                        {props.avatarJsx} {props.presenceJsx}
                    </div>
                    <div className="mx_MemberTileView_name">{props.nameJsx}</div>
                </div>
                <div className="mx_MemberTileView_right">
                    {props.userLabelJsx}
                    {props.e2eIconJsx}
                </div>
            </AccessibleButton>
        </div>
    );
}

export function ThreePidInviteTileView(props: ThreePidProps): JSX.Element {
    const vm = useThreePidTileViewModel(props);
    const av = <BaseAvatar name={vm.name} size="32px" aria-hidden="true" />;
    return <MemberTile nameJsx={vm.name} avatarJsx={av} onClick={vm.onClick} />;
}

export function RoomMemberTileView(props: IProps): JSX.Element {
    const vm = useMemberTileViewModel(props);
    const member = vm.member;
    const av = (
        <BaseAvatar
            size="32px"
            name={member.name}
            idName={member.userId}
            title={member.displayUserId}
            url={member.avatarThumbnailUrl}
            altText={_t("common|user_avatar")}
        />
    );
    const name = vm.name;
    const nameJSX = <DisambiguatedProfile member={member} fallbackName={name || ""} />;

    const presenceState = member.presenceState;
    let presenceJSX: JSX.Element | undefined;
    if (vm.showPresence && presenceState) {
        presenceJSX = <AvatarPresenceIconView presenceState={presenceState} />;
    }

    let userLabelJSX;
    if (vm.userLabel) {
        userLabelJSX = <div className="mx_MemberTileView_user_label">{vm.userLabel}</div>;
    }

    let e2eIcon;
    if (vm.e2eStatus) {
        e2eIcon = <E2EIconView status={vm.e2eStatus} />;
    }

    return (
        <MemberTile
            title={vm.title}
            onClick={vm.onClick}
            avatarJsx={av}
            presenceJsx={presenceJSX}
            nameJsx={nameJSX}
            userLabelJsx={userLabelJSX}
            e2eIconJsx={e2eIcon}
        />
    );
}
