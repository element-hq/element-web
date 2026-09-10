/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect } from "react";
import { useCreateAutoDisposedViewModel, DisambiguatedProfileView } from "@element-hq/web-shared-components";
import { VideoCallSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type RoomMember } from "../../../../../models/rooms/RoomMember";
import { useMemberTileViewModel } from "../../../../viewmodels/memberlist/tiles/MemberTileViewModel";
import { E2EIconView } from "./common/E2EIconView";
import AvatarPresenceIconView from "./common/PresenceIconView";
import BaseAvatar from "../../../avatars/BaseAvatar";
import { _t } from "../../../../../languageHandler";
import { MemberTileView } from "./common/MemberTileView";
import { InvitedIconView } from "./common/InvitedIconView";
import { type MemberWithSeparator } from "../../../../viewmodels/memberlist/MemberListViewModel";
import { DisambiguatedProfileViewModel } from "../../../../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";
import { useUserStatus } from "../../../../../hooks/useUserStatus";

interface IProps {
    /**
     * Needed for `onFocus`
     */
    item: MemberWithSeparator;
    member: RoomMember;
    isCallParticipant?: boolean;
    memberIndex: number;
    memberCount: number;
    showPresence?: boolean;
    focused?: boolean;
    tabIndex?: number;
    onFocus: (item: MemberWithSeparator, e: React.FocusEvent) => void;
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
    const userStatus = useUserStatus(member.userId);
    const disambiguatedProfileVM = useCreateAutoDisposedViewModel(
        () =>
            new DisambiguatedProfileViewModel({
                fallbackName: name,
                member,
                withTooltip: true,
                userStatus,
            }),
    );
    useEffect(() => {
        disambiguatedProfileVM.setMember(name, member);
    }, [disambiguatedProfileVM, member, name]);
    useEffect(() => {
        disambiguatedProfileVM.setUserStatus(userStatus);
    }, [disambiguatedProfileVM, userStatus]);
    const nameJSX = <DisambiguatedProfileView vm={disambiguatedProfileVM} className="mx_DisambiguatedProfile" />;

    const presenceState = member.presenceState;
    let presenceJSX: JSX.Element | undefined;
    if (vm.showPresence && presenceState) {
        presenceJSX = <AvatarPresenceIconView presenceState={presenceState} />;
    }

    let iconJsx: JSX.Element | undefined;
    if (member.isInvite) {
        iconJsx = <InvitedIconView isThreePid={false} />;
    } else if (vm.e2eStatus || props.isCallParticipant) {
        iconJsx = (
            <>
                {vm.e2eStatus && <E2EIconView status={vm.e2eStatus} />}
                {props.isCallParticipant && (
                    <VideoCallSolidIcon
                        className="mx_RoomMemberTileView_callIcon"
                        width="16px"
                        height="16px"
                        fill="var(--cpd-color-icon-accent-primary)"
                    />
                )}
            </>
        );
    }

    return (
        <MemberTileView
            onClick={vm.onClick}
            onFocus={(e) => props.onFocus(props.item, e)}
            avatarJsx={av}
            presenceJsx={presenceJSX}
            nameJsx={nameJSX}
            userLabel={vm.userLabel}
            ariaLabel={props.isCallParticipant && !member.isInvite ? _t("member_list|in_call_label", { name }) : name}
            iconJsx={iconJsx}
            focused={props.focused}
            tabIndex={props.tabIndex}
            memberIndex={props.memberIndex}
            memberCount={props.memberCount}
        />
    );
}
