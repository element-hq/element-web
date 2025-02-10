/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { useThreePidTileViewModel } from "../../../../viewmodels/memberlist/tiles/ThreePidTileViewModel";
import { type ThreePIDInvite } from "../../../../../models/rooms/ThreePIDInvite";
import BaseAvatar from "../../../avatars/BaseAvatar";
import { MemberTileView } from "./common/MemberTileView";
import { InvitedIconView } from "./common/InvitedIconView";

interface Props {
    threePidInvite: ThreePIDInvite;
}

export function ThreePidInviteTileView(props: Props): JSX.Element {
    const vm = useThreePidTileViewModel(props);
    const av = <BaseAvatar name={vm.name} size="32px" aria-hidden="true" />;
    const iconJsx = <InvitedIconView isThreePid={true} />;

    return (
        <MemberTileView
            nameJsx={vm.name}
            avatarJsx={av}
            onClick={vm.onClick}
            userLabel={vm.userLabel}
            iconJsx={iconJsx}
        />
    );
}
