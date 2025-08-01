/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import DisambiguatedProfile from "../../../messages/DisambiguatedProfile";
import { type RoomMember } from "../../../../../models/rooms/RoomMember";
import { useMemberTileViewModel } from "../../../../viewmodels/memberlist/tiles/MemberTileViewModel";
import { E2EIconView } from "./common/E2EIconView";
import AvatarPresenceIconView from "./common/PresenceIconView";
import BaseAvatar from "../../../avatars/BaseAvatar";
import { _t } from "../../../../../languageHandler";
import { MemberTileView } from "./common/MemberTileView";
import { InvitedIconView } from "./common/InvitedIconView";

interface IProps {
    member: RoomMember;
    index: number;
    memberCount: number;
    showPresence?: boolean;
    focused?: boolean;
    tabIndex?: number;
    onFocus: (e: React.FocusEvent) => void;
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
    const nameJSX = <DisambiguatedProfile withTooltip member={member} fallbackName={name || ""} />;

    const presenceState = member.presenceState;
    let presenceJSX: JSX.Element | undefined;
    if (vm.showPresence && presenceState) {
        presenceJSX = <AvatarPresenceIconView presenceState={presenceState} />;
    }

    let iconJsx;
    if (vm.e2eStatus) {
        iconJsx = <E2EIconView status={vm.e2eStatus} />;
    }
    if (member.isInvite) {
        iconJsx = <InvitedIconView isThreePid={false} />;
    }

    return (
        <MemberTileView
            onClick={vm.onClick}
            onFocus={props.onFocus}
            avatarJsx={av}
            presenceJsx={presenceJSX}
            nameJsx={nameJSX}
            userLabel={vm.userLabel}
            ariaLabel={name}
            iconJsx={iconJsx}
            focused={props.focused}
            tabIndex={props.tabIndex}
            memberIndex={props.index - (member.isInvite ? 1 : 0)} // Adjust as invites are below the seperator
            memberCount={props.memberCount}
        />
    );
}
