/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type User, type RoomMember } from "matrix-js-sdk/src/matrix";
import { Heading, Tooltip, Text, Button, InlineSpinner, Badge } from "@vector-im/compound-web";
import { VerifiedIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import {
    type UserfoHeaderProps,
    useUserfoHeaderViewModel,
    useUserInfoVerificationSection,
} from "../../../viewmodels/right_panel/user_info/UserInfoHeaderViewModel";
import MemberAvatar from "../../avatars/MemberAvatar";
import { Container, type IDevice } from "../UserInfo";
import { Flex } from "../../../utils/Flex";
import PresenceLabel from "../../rooms/PresenceLabel";
import CopyableText from "../../elements/CopyableText";

export const UserInfoHeaderView: React.FC<UserfoHeaderProps> = ({
    member,
    devices,
    roomId,
    hideVerificationSection,
}) => {
    const vm = useUserfoHeaderViewModel({ member, devices, roomId, hideVerificationSection });
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
                {!hideVerificationSection && <VerificationSection member={member} devices={devices} />}
            </Container>
        </React.Fragment>
    );
};

const VerificationSection: React.FC<{
    member: User | RoomMember;
    devices: IDevice[];
}> = ({ member, devices }) => {
    let content;
    const vm = useUserInfoVerificationSection(member, devices);

    if (vm.isUserVerified) {
        content = (
            <Badge kind="green" className="mx_UserInfo_verified_badge">
                <VerifiedIcon className="mx_UserInfo_verified_icon" height="16px" width="16px" />
                <Text size="sm" weight="medium" className="mx_UserInfo_verified_label">
                    {_t("common|verified")}
                </Text>
            </Badge>
        );
    } else if (vm.hasCrossSigningKeys === undefined) {
        // We are still fetching the cross-signing keys for the user, show spinner.
        content = <InlineSpinner size={24} />;
    } else if (vm.canVerify && vm.hasCrossSigningKeys) {
        content = (
            <div className="mx_UserInfo_container_verifyButton">
                <Button
                    className="mx_UserInfo_verify_button"
                    kind="tertiary"
                    size="sm"
                    onClick={() => vm.verifySelectedUser}
                >
                    {_t("user_info|verify_button")}
                </Button>
            </div>
        );
    } else {
        content = (
            <Text className="mx_UserInfo_verification_unavailable" size="sm">
                ({_t("user_info|verification_unavailable")})
            </Text>
        );
    }

    return (
        <Flex justify="center" align="center" className="mx_UserInfo_verification">
            {content}
        </Flex>
    );
};
