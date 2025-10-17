/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The props that must be passed to a RoomView component.
 * @alpha Subject to change.
 */
export interface RoomViewProps {
    roomId?: string;
}

/**
 * Exposes components and classes that are part of Element Web to allow modules to
 * render the components as part of their custom components or use the classes
 * (because they can't import the components from Element Web since it would cause
 * a dependency cycle)
 * @alpha
 */
export interface BuiltinsApi {
    getRoomViewComponent(): React.ComponentType<RoomViewProps>;
}
