/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createContext, useMemo } from "react";

import { useCurrentPhase } from "../hooks/right-panel/useCurrentPhase";
import { type RightPanelPhases } from "../stores/right-panel/RightPanelStorePhases";

type Context = {
    isPanelOpen: boolean;
    currentPhase: RightPanelPhases | null;
};

export const CurrentRightPanelPhaseContext = createContext<Context | null>(null);

type Props = {
    roomId: string;
};

export const CurrentRightPanelPhaseContextProvider: React.FC<React.PropsWithChildren<Props>> = ({
    roomId,
    children,
}) => {
    const { currentPhase, isOpen } = useCurrentPhase(roomId);
    const context = useMemo(() => ({ currentPhase, isPanelOpen: isOpen }), [currentPhase, isOpen]);
    return <CurrentRightPanelPhaseContext.Provider value={context}>{children}</CurrentRightPanelPhaseContext.Provider>;
};
