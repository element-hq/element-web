/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface RoomViewProps {
    roomId?: string;
}

/**
 * Exposes components that are part of Element Web to allow modules to render them
 * as part of their custom components (because they can't import the components from
 * Element Web since it would cause a dependency cycle)
 */
export interface BuiltinsApi {
    getRoomViewComponent(): React.ComponentType<RoomViewProps>;
}
