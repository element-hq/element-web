/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type PropsWithChildren, type JSX } from "react";
import React from "react";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";

/**
 * Snapshot interface for the ReactionsRowButtonTooltip view.
 */
export interface ReactionsRowButtonTooltipViewSnapshot {
    /**
     * The formatted list of sender names who reacted.
     * If undefined, the tooltip should not be shown.
     */
    formattedSenders?: string;
    /**
     * The caption to display (e.g., the shortcode of the reaction).
     */
    caption?: string;
    /**
     * The children to wrap with the tooltip.
     */
    children?: PropsWithChildren["children"];
}

export type ReactionsRowButtonTooltipViewModel = ViewModel<ReactionsRowButtonTooltipViewSnapshot>;

interface ReactionsRowButtonTooltipViewProps {
    /**
     * The view model for the reactions row button tooltip.
     */
    vm: ReactionsRowButtonTooltipViewModel;
    
}

/**
 * Type alias for the ReactionsRowButtonTooltip view model.
 */
export function ReactionsRowButtonTooltipView({ vm }: Readonly<ReactionsRowButtonTooltipViewProps>): JSX.Element {
    const { formattedSenders, caption, children } = useViewModel(vm);

    if (formattedSenders) {
        return (
            <Tooltip description={formattedSenders} caption={caption} placement="right">
                {children}
            </Tooltip>
        );
    }

    return <>{children}</>;
}
