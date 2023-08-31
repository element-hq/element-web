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

import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { IRightPanelCardState } from "../../stores/right-panel/RightPanelStoreIPanelState";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";

/**
 * Helper to toggle a right panel view.
 * @param phase The right panel phase.
 * @param cardState The state within the phase.
 */
export function setPhase(phase: RightPanelPhases, cardState?: Partial<IRightPanelCardState>): void {
    const rps = RightPanelStore.instance;
    if (rps.currentCard.phase == phase && !cardState && rps.isOpen) {
        rps.togglePanel(null);
    } else {
        RightPanelStore.instance.setCard({ phase, state: cardState });
        if (!rps.isOpen) rps.togglePanel(null);
    }
}
