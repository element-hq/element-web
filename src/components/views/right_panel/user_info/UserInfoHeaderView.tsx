/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type User, type RoomMember } from "matrix-js-sdk/src/matrix";
import { Heading, Tooltip, Text } from "@vector-im/compound-web";

import { useUserfoHeaderViewModel } from "../../../viewmodels/right_panel/user_info/UserInfoHeaderViewModel";
import MemberAvatar from "../../avatars/MemberAvatar";
import { Container, type Member, type IDevice } from "../UserInfo";
import { Flex } from "../../../../shared-components/utils/Flex";
import PresenceLabel from "../../rooms/PresenceLabel";
import CopyableText from "../../elements/CopyableText";
import { UserInfoHeaderVerificationView } from "./UserInfoHeaderVerificationView";

export interface UserInfoHeaderViewProps {
    member: Member;
    roomId?: string;
    devices: IDevice[];
    hideVerificationSection: boolean;
}

export const UserInfoHeaderView: React.FC<UserInfoHeaderViewProps> = ({
    member,
    devices,
    roomId,
    hideVerificationSection,
}) => {
    const vm = useUserfoHeaderViewModel({ member, roomId });
    const avatarUrl = (member as User).avatarUrl;
    const displayName = (member as RoomMember).rawDisplayName;

    let presenceLabel: JSX.Element | undefined;

    if (vm.showPresence) {
        presenceLabel = (
            <PresenceLabel
                activeAgo={vm.precenseInfo.lastActiveAgo}
                currentlyActive={vm.precenseInfo.currentlyActive}
                presenceState={vm.precenseInfo.state}
                className="mx_UserInfo_profileStatus"
                coloured
            />
        );
    }

    return (
        <React.Fragment>
            <div className="mx_UserInfo_avatar">
                <div className="mx_UserInfo_avatar_transition">
                    <div className="mx_UserInfo_avatar_transition_child">
                        <MemberAvatar
                            key={member.userId} // to instantly blank the avatar when UserInfo changes members
                            member={member as RoomMember}
                            size="120px"
                            resizeMethod="scale"
                            fallbackUserId={member.userId}
                            onClick={vm.onMemberAvatarClick}
                            urls={avatarUrl ? [avatarUrl] : undefined}
                        />
                    </div>
                </div>
            </div>

            <Container className="mx_UserInfo_header">
                <Flex direction="column" align="center" className="mx_UserInfo_profile">
                    <Heading size="sm" weight="semibold" as="h1" dir="auto">
                        <Flex className="mx_UserInfo_profile_name" direction="row-reverse" align="center">
                            {displayName}
                        </Flex>
                    </Heading>
                    {presenceLabel}
                    {vm.timezoneInfo && (
                        <Tooltip label={vm.timezoneInfo?.timezone ?? ""}>
                            <Flex align="center" className="mx_UserInfo_timezone">
                                <Text size="sm" weight="regular">
                                    {vm.timezoneInfo?.friendly ?? ""}
                                </Text>
                            </Flex>
                        </Tooltip>
                    )}
                    <Text size="sm" weight="semibold" className="mx_UserInfo_profile_mxid">
                        <CopyableText getTextToCopy={() => vm.userIdentifier} border={false}>
                            {vm.userIdentifier}
                        </CopyableText>
                    </Text>
                </Flex>
                {!hideVerificationSection && <UserInfoHeaderVerificationView member={member} devices={devices} />}
            </Container>
        </React.Fragment>
    );
};
