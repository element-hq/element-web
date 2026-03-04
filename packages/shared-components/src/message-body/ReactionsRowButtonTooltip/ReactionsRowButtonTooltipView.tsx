/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type PropsWithChildren, type JSX } from "react";
import React from "react";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";

/**
 * Snapshot interface for the ReactionsRowButtonTooltip view.
 */
export interface ReactionsRowButtonTooltipViewSnapshot {
    /**
     * The formatted list of sender names who reacted.
     */
    formattedSenders?: string;
    /**
     * The caption to display (e.g., the shortcode of the reaction).
     */
    caption?: string;
    /**
     * Whether the tooltip should be forced open.
     */
    tooltipOpen?: boolean;
}

export type ReactionsRowButtonTooltipViewModel = ViewModel<ReactionsRowButtonTooltipViewSnapshot>;

interface ReactionsRowButtonTooltipViewProps {
    /**
     * The view model for the reactions row button tooltip.
     */
    vm: ReactionsRowButtonTooltipViewModel;
    /**
     * The children to wrap with the tooltip.
     */
    children?: PropsWithChildren["children"];
}

/**
 * Type alias for the ReactionsRowButtonTooltip view model.
 */
export function ReactionsRowButtonTooltipView({
    vm,
    children,
}: Readonly<ReactionsRowButtonTooltipViewProps>): JSX.Element {
    const { formattedSenders, caption, tooltipOpen } = useViewModel(vm);

    if (formattedSenders) {
        return (
            <Tooltip description={formattedSenders} caption={caption} placement="right" open={tooltipOpen}>
                {children}
            </Tooltip>
        );
    }

    return <>{children}</>;
}
