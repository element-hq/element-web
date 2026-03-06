/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { SeparatorViewSnapshot } from "./separator/SeparatorView";
import type { LeftResizablePanelViewSnapshot } from "./panel/LeftResizablePanelView";

/**
 * This is the id given to the resizable container that holds
 * the left panel contents.
 */
export const LEFT_PANEL_ID = "left-panel";

export * from "./group/GroupView";
export * from "./separator/SeparatorView";
export * from "./panel/LeftResizablePanelView";

export type ResizerSnapshot = SeparatorViewSnapshot & LeftResizablePanelViewSnapshot;

/**
 * Export relevant parts of the underlying library.
 */
export { Group, Panel, Separator, type PanelSize, type PanelImperativeHandle } from "react-resizable-panels";
