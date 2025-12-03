/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type RoomViewProps, type BuiltinsApi } from "@element-hq/element-web-module-api";

import { MatrixClientPeg } from "../MatrixClientPeg";
import type { Room } from "matrix-js-sdk/src/matrix";
import type { ModuleNotificationDecorationProps } from "./components/ModuleNotificationDecoration";

interface RoomViewPropsWithRoomId extends RoomViewProps {
    /**
     * The ID of the room to display
     */
    roomId?: string;
}

interface RoomAvatarProps {
    room: Room;
    size?: string;
}

interface Components {
    roomView: React.ComponentType<RoomViewPropsWithRoomId>;
    roomAvatar: React.ComponentType<RoomAvatarProps>;
    notificationDecoration: React.ComponentType<ModuleNotificationDecorationProps>;
}

export class ElementWebBuiltinsApi implements BuiltinsApi {
    private _roomView?: Components["roomView"];
    private _roomAvatar?: Components["roomAvatar"];
    private _notificationDecoration?: Components["notificationDecoration"];

    /**
     * Sets the components used by the API.
     *
     * This only really exists here because referencing these components directly causes a nightmare of
     * circular dependencies that break the whole app, so instead we avoid referencing it here
     * and pass it in from somewhere it's already referenced (see related comment in app.tsx).
     *
     * @param component The components used by the api, see {@link Components}
     */
    public setComponents(components: Components): void {
        this._roomView = components.roomView;
        this._roomAvatar = components.roomAvatar;
        this._notificationDecoration = components.notificationDecoration;
    }

    public getRoomViewComponent(): React.ComponentType<RoomViewPropsWithRoomId> {
        if (!this._roomView) {
            throw new Error("No RoomView component has been set");
        }
        return this._roomView;
    }

    public getRoomAvatarComponent(): React.ComponentType<RoomAvatarProps> {
        if (!this._roomAvatar) {
            throw new Error("No RoomAvatar component has been set");
        }
        return this._roomAvatar;
    }

    public getNotificationDecorationComponent(): React.ComponentType<ModuleNotificationDecorationProps> {
        if (!this._notificationDecoration) {
            throw new Error("No NotificationDecoration component has been set");
        }
        return this._notificationDecoration;
    }

    public renderRoomView(roomId: string, props?: RoomViewProps): React.ReactNode {
        const Component = this.getRoomViewComponent();
        return <Component roomId={roomId} {...props} />;
    }

    public renderRoomAvatar(roomId: string, size?: string): React.ReactNode {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) {
            throw new Error(`No room such room: ${roomId}`);
        }
        const Component = this.getRoomAvatarComponent();
        return <Component room={room} size={size} />;
    }

    public renderNotificationDecoration(roomId: string): React.ReactNode {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) {
            throw new Error(`No room such room: ${roomId}`);
        }
        const Component = this.getNotificationDecorationComponent();
        return <Component room={room} />;
    }
}
