/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { ActionPayload } from "../../../dispatcher/payloads";
import RightPanelStore from "../RightPanelStore";
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
            phase: RightPanelPhases.Room3pidMemberInfo,
            state: { memberInfoEvent: payload.event },
        });
    } else {
        rightPanelStore.showOrHidePanel(RightPanelPhases.RoomMemberList);
    }
};
