/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type PropsWithChildren } from "react";
import { Group, type Layout } from "react-resizable-panels";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { LEFT_PANEL_ID } from "..";

export interface GroupViewActions {
    /**
     * Indicates to the view-model that the left panel was resized.
     * @param newSize The new size of the left panel
     */
    onLeftPanelResized: (newSize: number) => void;
}

interface Props {
    vm: ViewModel<unknown, GroupViewActions>;
}

/**
 * This the root component for collapsible left panel. Based on {@link Group} from react-resizable-panels.
 */
export function GroupView({ vm, children }: PropsWithChildren<Props>): React.ReactNode {
    useViewModel(vm);

    /**
     * Take layout data provided by the library and pass just the size
     * of the left panel to the vm.
     */
    const onLayoutChanged = (layout: Layout): void => {
        const newSize = layout[LEFT_PANEL_ID];
        vm.onLeftPanelResized(newSize);
    };

    return <Group onLayoutChanged={onLayoutChanged}>{children}</Group>;
}
