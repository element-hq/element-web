/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JSX } from "react";

interface SpacePanelItemProps {
    isPanelCollapsed: boolean;
}

/**
 * The type of the function used to render a space panel item.
 * @alpha
 */
export type SpacePanelItemRenderFunction = (props: SpacePanelItemProps) => JSX.Element;

/**
 * API for inserting extra UI into Element Web.
 * @alpha Subject to change.
 */
export interface ExtrasApi {
    addSpacePanelItem(renderer: SpacePanelItemRenderFunction): void;
}
