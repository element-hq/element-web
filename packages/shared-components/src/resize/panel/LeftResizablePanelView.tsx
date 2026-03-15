/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useEffect, type PropsWithChildren } from "react";
import {
    Panel,
    type PanelProps,
    usePanelCallbackRef,
    type PanelImperativeHandle,
    type PanelSize,
} from "react-resizable-panels";

import { type ViewModel, useViewModel } from "../../viewmodel";
import { LEFT_PANEL_ID, type ResizerViewSnapshot } from "..";

export interface LeftResizablePanelViewActions {
    /**
     * Indicates to the view-model that the left panel is being resized.
     * @param panelSize The new panel size.
     */
    onLeftPanelResize: (panelSize: PanelSize) => void;

    /**
     * Pass the vm the object containing the API to interact with this panel.
     * @param handle Object that can be used to access the imperative methods of the panel.
     */
    setPanelHandle: (handle: PanelImperativeHandle) => void;
}

type Props = {
    vm: ViewModel<ResizerViewSnapshot, LeftResizablePanelViewActions>;
    className?: string;
} & Pick<PanelProps, "minSize" | "maxSize" | "defaultSize">;

/**
 * This is a custom panel component for the left-panel. It is used along with SeparatorView, Group and Panel to render
 * collapsible room list.
 */
export function LeftResizablePanelView({
    vm,
    className,
    children,
    ...props
}: PropsWithChildren<Props>): React.ReactNode {
    const { initialSize, isCollapsed } = useViewModel(vm);
    const [panelRef, setPanelRef] = usePanelCallbackRef();

    useEffect(() => {
        if (panelRef) vm.setPanelHandle(panelRef);
    }, [vm, panelRef]);

    const defaultSize = initialSize === undefined ? props.defaultSize : `${initialSize}%`;

    return (
        <Panel
            inert={isCollapsed}
            id={LEFT_PANEL_ID}
            className={className}
            collapsible
            minSize={props.minSize}
            maxSize={props.maxSize}
            defaultSize={defaultSize}
            onResize={vm.onLeftPanelResize}
            panelRef={setPanelRef}
        >
            {children}
        </Panel>
    );
}
