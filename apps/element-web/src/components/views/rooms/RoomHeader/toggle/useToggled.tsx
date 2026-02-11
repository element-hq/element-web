/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useContext } from "react";

import { type RightPanelPhases } from "../../../../../stores/right-panel/RightPanelStorePhases";
import { CurrentRightPanelPhaseContext } from "../../../../../contexts/CurrentRightPanelPhaseContext";

/**
 * Hook to easily track whether a given right panel phase is toggled on/off.
 */
export function useToggled(phase: RightPanelPhases): boolean {
    const context = useContext(CurrentRightPanelPhaseContext);
    if (!context) {
        return false;
    }
    const { currentPhase, isPanelOpen } = context;
    return !!(isPanelOpen && currentPhase === phase);
}
