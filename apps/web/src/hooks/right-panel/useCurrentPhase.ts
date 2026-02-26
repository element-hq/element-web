/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useContext, useState } from "react";

import { SDKContext } from "../../contexts/SDKContext";
import { type RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import { useEventEmitter } from "../useEventEmitter";
import { UPDATE_EVENT } from "../../stores/AsyncStore";

/**
 * Returns:
 * - state which will always reflect the currently active right panel phase or null.
 * - boolean state representing whether any panel is open or not.
 * @param roomId room id if available.
 */
export function useCurrentPhase(roomId?: string): { currentPhase: RightPanelPhases | null; isOpen: boolean } {
    const sdkContext = useContext(SDKContext);

    const getCurrentPhase = (): RightPanelPhases | null => {
        const card = roomId
            ? sdkContext.rightPanelStore.currentCardForRoom(roomId)
            : sdkContext.rightPanelStore.currentCard;
        return card.phase;
    };

    const getIsOpen = (): boolean => {
        const isOpen = roomId ? sdkContext.rightPanelStore.isOpenForRoom(roomId) : sdkContext.rightPanelStore.isOpen;
        return isOpen;
    };

    const [currentPhase, setCurrentPhase] = useState<RightPanelPhases | null>(getCurrentPhase());
    const [isOpen, setIsOpen] = useState<boolean>(getIsOpen());

    useEventEmitter(sdkContext.rightPanelStore, UPDATE_EVENT, () => {
        setCurrentPhase(getCurrentPhase());
        setIsOpen(getIsOpen());
    });

    return { currentPhase, isOpen };
}
