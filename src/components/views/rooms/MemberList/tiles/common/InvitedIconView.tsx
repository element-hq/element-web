/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import EmailIcon from "@vector-im/compound-design-tokens/assets/web/icons/email-solid";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add-solid";

import { Flex } from "../../../../../utils/Flex";

interface Props {
    isThreePid: boolean;
}

export function InvitedIconView({ isThreePid }: Props): JSX.Element {
    const Icon = isThreePid ? EmailIcon : UserAddIcon;
    return (
        <Flex align="center" className="mx_InvitedIconView">
            <Icon height="16px" width="16px" />
        </Flex>
    );
}
