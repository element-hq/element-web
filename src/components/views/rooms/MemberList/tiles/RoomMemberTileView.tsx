/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import DisambiguatedProfile from "../../../messages/DisambiguatedProfile";
import { RoomMember } from "../../../../../models/rooms/RoomMember";
import { useMemberTileViewModel } from "../../../../viewmodels/memberlist/tiles/MemberTileViewModel";
import { E2EIconView } from "./common/E2EIconView";
import AvatarPresenceIconView from "./common/PresenceIconView";
import BaseAvatar from "../../../avatars/BaseAvatar";
import { _t } from "../../../../../languageHandler";
import { MemberTileLayout } from "./common/MemberTileLayout";

interface IProps {
    member: RoomMember;
    showPresence?: boolean;
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
        <MemberTileLayout
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
