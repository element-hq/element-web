/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../../../dispatcher/payloads";
import type RightPanelStore from "../RightPanelStore";
import { RightPanelPhases } from "../RightPanelStorePhases";

/**
 * Handle an Action.View3pidInvite action.
 * Where payload has an event, open the right panel with 3pid room member info without clearing right panel history.
 * Otherwise, 'close' the 3pid member info by displaying the room member list in the right panel.
 * @param payload
 * @param rightPanelStore store instance
 */
export const onView3pidInvite = (payload: ActionPayload, rightPanelStore: RightPanelStore): void => {
    if (payload.event) {
        rightPanelStore.pushCard({
            phase: RightPanelPhases.ThreePidMemberInfo,
            state: { memberInfoEvent: payload.event },
        });
    } else {
        rightPanelStore.showOrHidePhase(RightPanelPhases.MemberList);
    }
};
