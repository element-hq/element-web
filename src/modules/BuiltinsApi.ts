/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomViewProps, type BuiltinsApi } from "@element-hq/element-web-module-api";

export class ElementWebBuiltinsApi implements BuiltinsApi {
    private _roomView?: React.ComponentType<RoomViewProps>;

    /**
     * Sets the components used to render a RoomView
     *
     * This only really exists here because referencing RoomView directly causes a nightmare of
     * circular dependencies that break the whole app, so instead we avoid referencing it here
     * and pass it in from somewhere it's already referenced (see related comment in app.tsx).
     *
     * @param component The RoomView component
     */
    public setRoomViewComponent(component: React.ComponentType<RoomViewProps>): void {
        this._roomView = component;
    }

    public getRoomViewComponent(): React.ComponentType<RoomViewProps> {
        if (!this._roomView) {
            throw new Error("No RoomView component has been set");
        }

        return this._roomView;
    }
}
