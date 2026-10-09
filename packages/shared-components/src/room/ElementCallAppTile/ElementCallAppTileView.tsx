/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type CSSProperties, type FC, type ReactNode } from "react";

import { useViewModel, type ViewModel } from "../../core/viewmodel";

/**
 * The application's CSS class names for the tile's elements. The tile has no styling of its own:
 * the containers it is dropped into style its box through these classes.
 */
export interface ElementCallAppTileViewClassNames {
    /** The tile's root element. */
    root?: string;
    /** The element wrapping the persisted root, which fixes the tile's height. */
    persistedWrapper?: string;
    /** The element wrapping Element Call inside the persisted root. */
    body?: string;
}

export interface ElementCallAppTileViewSnapshot {
    /**
     * Whether there is nothing to show: no Element Call in this room, or no room at all.
     * The tile renders nothing at all in that case, rather than an empty frame.
     */
    hidden: boolean;
    /**
     * The application's class names for the tile's elements, which is how a floating tile (the
     * picture-in-picture window) and a docked one come to look different.
     */
    classNames?: ElementCallAppTileViewClassNames;
    /** Identifies the persisted root that holds the call, across every tile that shows it. */
    persistKey: string;
    /** Stacking order of the persisted root relative to other persisted apps. */
    zIndex: number;
    /** Set while the tile is being dragged or resized, so the call does not swallow the pointer. */
    pointerEvents?: CSSProperties["pointerEvents"];
}

export interface ElementCallAppTileViewActions {
    /**
     * Renders its children in a React tree outside this one, so that the call survives this tile
     * unmounting and can move between containers without reloading.
     *
     * `PersistedElement` is not available in shared components, so the view model supplies it. It
     * can be any component that renders its children elsewhere and keeps them alive.
     */
    PersistedElement: FC<{ persistKey: string; zIndex: number; children: ReactNode }>;
    /**
     * Element Call itself, with everything Element Web hands it (the client, the host bridge, the
     * theme and the language). Rendered inside the persisted root, so every tile of the call
     * renders the same component instance.
     */
    ElementCall: FC;
}

/**
 * The view model for the Element Call app tile.
 */
export type ElementCallAppTileViewModel = ViewModel<ElementCallAppTileViewSnapshot> & ElementCallAppTileViewActions;

export interface ElementCallAppTileViewProps {
    /**
     * The ElementCallAppTileViewModel, which exposes the ElementCallAppTileViewSnapshot and the
     * two components this view cannot import: the persisted root and Element Call itself.
     */
    vm: ElementCallAppTileViewModel;
    /**
     * Rendered over the call, inside the persisted root: the picture-in-picture window's own
     * controls, for instance.
     */
    overlay?: ReactNode;
}

/**
 * The tile for an Element Call rendered as an in-process React component rather than as an iframe.
 *
 * The tile decides only where the call is shown; what is shown is `vm.ElementCall` in the persisted
 * root, which every tile of the call renders alike, so moving the call between containers does not
 * disturb the component.
 *
 * The tile has no styling of its own: the application names the classes of its elements in the
 * snapshot, and the containers the tile is dropped into style it like any other app tile through them.
 */
export const ElementCallAppTileView: FC<ElementCallAppTileViewProps> = ({ vm, overlay }) => {
    const { hidden, classNames, persistKey, zIndex, pointerEvents } = useViewModel(vm);
    if (hidden) return null;

    return (
        <div className={classNames?.root}>
            {/* Wrap the persisted root in a div to fix the height, otherwise the tile's border is in the wrong place */}
            <div className={classNames?.persistedWrapper}>
                <vm.PersistedElement persistKey={persistKey} zIndex={zIndex}>
                    <div className={classNames?.body} style={pointerEvents ? { pointerEvents } : undefined}>
                        <vm.ElementCall />
                    </div>
                    {overlay}
                </vm.PersistedElement>
            </div>
        </div>
    );
};
