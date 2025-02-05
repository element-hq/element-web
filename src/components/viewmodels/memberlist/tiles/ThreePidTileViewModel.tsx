/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { type ThreePIDInvite } from "../../../../models/rooms/ThreePIDInvite";
import { _t } from "../../../../languageHandler";

interface ThreePidTileViewModelProps {
    threePidInvite: ThreePIDInvite;
}

export interface ThreePidTileViewState {
    name: string;
    onClick: () => void;
    userLabel?: string;
}

export function useThreePidTileViewModel(props: ThreePidTileViewModelProps): ThreePidTileViewState {
    const invite = props.threePidInvite;
    const name = invite.event.getContent().display_name;
    const onClick = (): void => {
        dis.dispatch({
            action: Action.View3pidInvite,
            event: invite.event,
        });
    };

    const userLabel = _t("member_list|invited_label");

    return {
        name,
        onClick,
        userLabel,
    };
}
