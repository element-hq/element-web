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
    /*
     * If true, the room header will be hidden.
     */
    hideHeader?: boolean;
    /*
     * If true, the message composer will be hidden.
     */
    hideComposer?: boolean;
    /*
     * If true, the right panel will be hidden.
     */
    hideRightPanel?: boolean;
}

/**
 * Exposes components and classes that are part of Element Web to allow modules to
 * render the components as part of their custom components or use the classes
 * (because they can't import the components from Element Web since it would cause
 * a dependency cycle)
 * @alpha
 */
export interface BuiltinsApi {
    /**
     * Render room avatar component from element-web.
     *
     * @alpha
     * @param roomId - Id of the room
     * @param size - Size of the avatar to render
     */
    renderRoomAvatar(roomId: string, size?: string): React.ReactNode;

    /**
     * Render room view component from element-web.
     *
     * @alpha
     * @param roomId - Id of the room
     * @param props - Additional props to pass to the room view
     */
    renderRoomView(roomId: string, props?: RoomViewProps): React.ReactNode;
}
