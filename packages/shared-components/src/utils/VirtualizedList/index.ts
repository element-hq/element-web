/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

export { VirtualizedList } from "./VirtualizedList";
export type { IVirtualizedListProps, VirtualizedListContext, ScrollIntoViewOnChange } from "./VirtualizedList";

// Re-export VirtuosoMockContext for testing purposes
// Tests should import this from shared-components to ensure context compatibility
export { VirtuosoMockContext } from "react-virtuoso";
