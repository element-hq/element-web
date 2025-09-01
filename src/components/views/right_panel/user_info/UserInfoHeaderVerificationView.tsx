/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type User, type RoomMember } from "matrix-js-sdk/src/matrix";
import { Text, Button, InlineSpinner, Badge } from "@vector-im/compound-web";
import { VerifiedIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useUserInfoVerificationViewModel } from "../../../viewmodels/right_panel/user_info/UserInfoHeaderVerificationViewModel";
import { type IDevice } from "../UserInfo";
import { Flex } from "../../../../shared-components/utils/Flex";
import { _t } from "../../../../languageHandler";

export const UserInfoHeaderVerificationView: React.FC<{
    member: User | RoomMember;
    devices: IDevice[];
}> = ({ member, devices }) => {
    let content;
    const vm = useUserInfoVerificationViewModel(member, devices);

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
                    onClick={() => vm.verifySelectedUser()}
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
