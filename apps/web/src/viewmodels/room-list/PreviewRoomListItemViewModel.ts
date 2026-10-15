/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    RoomNotifState,
    type RoomListItemViewSnapshot,
    type RoomListItemViewActions,
} from "@element-hq/web-shared-components";

import dispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import type { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { PreviewRoomAvatarData } from "./PreviewRoomAvatarData";

/**
 * What we know about a room that the user is looking at but isn't in the room list.
 */
export interface PreviewRoomListItemProps {
    /** The id of the room. */
    roomId: string;
    /** The name of the room. */
    name: string;
    /** The mxc:// URL of the room avatar, if any. */
    avatarUrl?: string;
    /** The type of the room, if any. */
    roomType?: string;
}

/**
 * View model for the room list item of the open room when the user isn't a member of it yet,
 * e.g. a room they can knock on or peek into.
 * The menus are hidden, so only opening the room does something.
 */
export class PreviewRoomListItemViewModel
    extends BaseViewModel<RoomListItemViewSnapshot, PreviewRoomListItemProps>
    implements RoomListItemViewActions
{
    public constructor(props: PreviewRoomListItemProps) {
        super(props, PreviewRoomListItemViewModel.generateSnapshot(props));
    }

    /**
     * The id of the room this item is for.
     */
    public get roomId(): string {
        return this.props.roomId;
    }

    private static generateSnapshot({
        roomId,
        name,
        avatarUrl,
        roomType,
    }: PreviewRoomListItemProps): RoomListItemViewSnapshot {
        return {
            id: roomId,
            room: new PreviewRoomAvatarData(roomId, name, avatarUrl, roomType),
            name,
            isBold: false,
            notification: {
                hasAnyNotificationOrActivity: false,
                isUnsentMessage: false,
                invited: false,
                isMention: false,
                isActivityNotification: false,
                isNotification: false,
                hasUnreadCount: false,
                count: 0,
                muted: false,
            },
            showMoreOptionsMenu: false,
            showNotificationMenu: false,
            isFavourite: false,
            isLowPriority: false,
            isDm: false,
            canInvite: false,
            canCopyRoomLink: false,
            canMarkAsRead: false,
            canMarkAsUnread: false,
            roomNotifState: RoomNotifState.AllMessages,
            sections: [],
            areSectionsEnabled: false,
            canChangeSection: false,
        };
    }

    public onOpenRoom = (): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.props.roomId,
            metricsTrigger: "RoomList",
        });
    };

    // The menus calling these actions are hidden for a preview item.
    public onMarkAsRead = (): void => {};
    public onMarkAsUnread = (): void => {};
    public onToggleFavorite = (): void => {};
    public onToggleLowPriority = (): void => {};
    public onInvite = (): void => {};
    public onCopyRoomLink = (): void => {};
    public onLeaveRoom = (): void => {};
    public onSetRoomNotifState = (): void => {};
    public onCreateSection = (): void => {};
    public onToggleSection = (): void => {};
    public onRemoveFromSection = (): void => {};
}
