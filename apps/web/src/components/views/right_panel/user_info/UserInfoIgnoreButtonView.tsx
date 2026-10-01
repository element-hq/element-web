/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import React from "react";
import { MenuItem } from "@vector-im/compound-web";
import { BlockIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import { useUserInfoIgnoreButtonViewModel } from "../../../viewmodels/right_panel/user_info/UserInfoIgnoreButtonViewModel";

export const IgnoreToggleButton: React.FC<{
    member: User | RoomMember;
}> = ({ member }) => {
    const vm = useUserInfoIgnoreButtonViewModel(member);

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => vm.ignoreButtonClick(ev)}
            label={vm.isIgnored ? _t("user_info|unignore_button") : _t("user_info|ignore_button")}
            kind="critical"
            Icon={BlockIcon}
        />
    );
};
