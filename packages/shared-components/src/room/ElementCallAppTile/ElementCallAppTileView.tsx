/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type CSSProperties, type FC, type ReactNode } from "react";
import classNames from "classnames";

import { useViewModel, type ViewModel } from "../../core/viewmodel";

export interface ElementCallAppTileViewSnapshot {
    /**
     * Whether there is nothing to show: no Element Call in this room, or no room at all.
     * The tile renders nothing at all in that case, rather than an empty frame.
     */
    hidden: boolean;
    /**
     * Whether the tile is a small floating one (the picture-in-picture window) rather than
     * one docked into a container.
     */
    miniMode: boolean;
    /** Whether a docked tile should fill the width of its container. */
    fullWidth: boolean;
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
 * The markup mirrors `AppTile`'s, and deliberately uses its global `mx_AppTile*` class names rather
 * than CSS modules: the styles live in Element Web's `_AppsDrawer.pcss` and are applied by the
 * containers the tile is dropped into (the apps drawer, the widget card, the sticker picker).
 */
export const ElementCallAppTileView: FC<ElementCallAppTileViewProps> = ({ vm, overlay }) => {
    const { hidden, miniMode, fullWidth, persistKey, zIndex, pointerEvents } = useViewModel(vm);
    if (hidden) return null;

    return (
        <div
            className={classNames({
                mx_AppTile_mini: miniMode,
                mx_AppTileFullWidth: !miniMode && fullWidth,
                mx_AppTile: !miniMode && !fullWidth,
            })}
        >
            {/* Wrap the persisted root in a div to fix the height, otherwise the tile's border is in the wrong place */}
            <div className="mx_AppTile_persistedWrapper">
                <vm.PersistedElement persistKey={persistKey} zIndex={zIndex}>
                    <div
                        className={classNames("mx_AppTileBody", {
                            "mx_AppTileBody--large": !miniMode,
                            "mx_AppTileBody--mini": miniMode,
                            // We don't want mx_AppTileBody (rounded corners) for call widgets
                            "mx_AppTileBody--call": true,
                        })}
                        style={pointerEvents ? { pointerEvents } : undefined}
                    >
                        <vm.ElementCall />
                    </div>
                    {overlay}
                </vm.PersistedElement>
            </div>
        </div>
    );
};
