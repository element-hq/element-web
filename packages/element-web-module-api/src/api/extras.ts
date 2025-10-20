/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JSX } from "react";

/**
 * Properties of an item added to the Space panel
 * @alpha
 */
export interface SpacePanelItemProps {
    /**
     * A CSS class name for the item
     */
    className?: string;

    /**
     * An icon to show in the item. If not provided, no icon will be shown.
     */
    icon?: JSX.Element;

    /**
     * The label to show in the item
     */
    label: string;

    /**
     * A tooltip to show when hovering over the item
     */
    tooltip?: string;

    /**
     * Styles to apply to the item
     */
    style?: React.CSSProperties;

    /**
     * Callback when the item is selected
     */
    onSelected?(): void;
}

/**
 * API for inserting extra UI into Element Web.
 * @alpha Subject to change.
 */
export interface ExtrasApi {
    /**
     * Inserts an item into the space panel as if it were a space button, below
     * buttons for other spaces.
     * If called again with the same spaceKey, will update the existing item.
     * @param spaceKey - A key to identify this space-like item.
     * @param props - Properties of the item to add.
     */
    setSpacePanelItem(spaceKey: string, props: SpacePanelItemProps): void;
}
