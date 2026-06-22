/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    ClientEvent,
    EventType,
    KnownMembership,
    RoomEvent,
    RoomStateEvent,
    RoomType,
    type Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { type RoomAvatarEventContent } from "matrix-js-sdk/src/types";

import {
    BaseViewModel,
    type RoomAvatarViewModel as RoomAvatarViewModelInterface,
    type RoomAvatarViewSnapshot,
} from "@element-hq/web-shared-components";

import * as Avatar from "../../Avatar";
import Modal from "../../Modal";
import ImageView from "../../components/views/elements/ImageView";
import { mediaFromMxc } from "../../customisations/Media";
import { LocalRoom } from "../../models/LocalRoom";
import { type IOOBData } from "../../stores/ThreepidInviteStore";
import SettingsStore from "../../settings/SettingsStore";
import DMRoomMap from "../../utils/DMRoomMap";
import { filterBoolean } from "../../utils/arrays";
import { MediaPreviewValue } from "../../@types/media_preview";

interface Props {
    room?: Room;
    size: string;
    oobData?: IOOBData & {
        roomId?: string;
    };
    viewAvatarOnClick?: boolean;
    onClick?: () => void;
    /** Optional shape override. When omitted the VM derives the shape from the room type. */
    type?: "round" | "square";
}

export class RoomAvatarViewModel
    extends BaseViewModel<RoomAvatarViewSnapshot, Props>
    implements RoomAvatarViewModelInterface
{
    private roomListenersCleanup?: () => void;
    private mediaPreviewSettingWatcherRef?: string;

    public constructor(props: Props) {
        super(props, RoomAvatarViewModel.computeSnapshot(props));
        this.bindRoomListeners(props.room);
        this.bindMediaPreviewSettingWatcher(props.room);

        this.disposables.track(() => {
            this.clearTrackedListeners();
        });
    }

    public setRoom(room?: Room): void {
        if (this.props.room === room) return;

        this.props = { ...this.props, room };
        this.bindRoomListeners(room);
        this.bindMediaPreviewSettingWatcher(room);
        this.refreshSnapshot();
    }

    public setSize(size: string): void {
        if (this.props.size === size) return;

        this.props = { ...this.props, size };
        this.refreshSnapshot();
    }

    public setOobData(oobData?: IOOBData & { roomId?: string }): void {
        if (this.props.oobData === oobData) return;

        this.props = { ...this.props, oobData };
        this.refreshSnapshot();
    }

    public setViewAvatarOnClick(viewAvatarOnClick?: boolean): void {
        if (this.props.viewAvatarOnClick === viewAvatarOnClick) return;

        this.props = { ...this.props, viewAvatarOnClick };
        this.refreshSnapshot();
    }

    public setOnClick(onClick?: () => void): void {
        if (this.props.onClick === onClick) return;

        this.props = { ...this.props, onClick };
        this.refreshSnapshot();
    }

    public setType(type?: "round" | "square"): void {
        if (this.props.type === type) return;

        this.props = { ...this.props, type };
        this.refreshSnapshot();
    }

    public onClick = (): void => {
        if (this.props.viewAvatarOnClick && this.snapshot.current.urls[0]) {
            const avatarUrl = Avatar.avatarUrlForRoom(this.props.room ?? null);
            if (!avatarUrl) return;

            Modal.createDialog(
                ImageView,
                {
                    src: avatarUrl,
                    name: this.props.room?.name,
                },
                "mx_Dialog_lightbox",
                undefined,
                true,
            );
            return;
        }

        this.props.onClick?.();
    };

    private static computeSnapshot(props: Props): RoomAvatarViewSnapshot {
        const urls = RoomAvatarViewModel.computeUrls(props);

        return {
            name: RoomAvatarViewModel.computeName(props.room, props.oobData),
            idName: RoomAvatarViewModel.computeIdName(props.room, props.oobData),
            urls,
            type: RoomAvatarViewModel.computeType(props),
            isClickable: Boolean(props.onClick || (props.viewAvatarOnClick && urls[0])),
        };
    }

    private static computeName(room?: Room, oobData?: IOOBData & { roomId?: string }): string {
        return room?.name ?? oobData?.name ?? "?";
    }

    private static computeIdName(room?: Room, oobData?: IOOBData & { roomId?: string }): string | undefined {
        const dmMember = RoomAvatarViewModel.getDmMember(room);
        if (dmMember) return dmMember.userId;

        if (room instanceof LocalRoom && room.targets.length === 1) return room.targets[0].userId;

        if (room) return room.roomId;

        return oobData?.roomId;
    }

    private static computeType(props: Props): "round" | "square" {
        if (props.type) return props.type;
        return (props.room?.getType() ?? props.oobData?.roomType) === RoomType.Space ? "square" : "round";
    }

    private static computeUrls(props: Props): string[] {
        const myMembership = props.room?.getMyMembership();
        const showAvatarsOnInvites =
            SettingsStore.getValue("mediaPreviewConfig", props.room?.roomId).invite_avatars === MediaPreviewValue.On;

        if (!showAvatarsOnInvites && (myMembership === KnownMembership.Invite || !myMembership)) {
            return [];
        }

        const sizeInt = parseInt(props.size, 10);
        let oobAvatar: string | null = null;
        if (props.oobData?.avatarUrl) {
            oobAvatar = mediaFromMxc(props.oobData.avatarUrl).getThumbnailOfSourceHttp(sizeInt, sizeInt, "crop");
        }

        return filterBoolean([
            oobAvatar,
            Avatar.avatarUrlForRoom(
                props.room ?? null,
                sizeInt,
                sizeInt,
                "crop",
                props.room?.currentState
                    .getStateEvents(EventType.RoomAvatar, "")
                    ?.getContent<RoomAvatarEventContent>().url,
            ),
        ]);
    }

    private static getDmMember(room?: Room): RoomMember | null {
        if (!room) return null;

        const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
        return otherUserId ? room.getMember(otherUserId) : null;
    }

    private refreshSnapshot = (): void => {
        const nextSnapshot = RoomAvatarViewModel.computeSnapshot(this.props);
        const current = this.snapshot.current;
        const updates: Partial<RoomAvatarViewSnapshot> = {};

        if (current.name !== nextSnapshot.name) updates.name = nextSnapshot.name;
        if (current.idName !== nextSnapshot.idName) updates.idName = nextSnapshot.idName;
        if (!RoomAvatarViewModel.areStringArraysEqual(current.urls, nextSnapshot.urls)) updates.urls = nextSnapshot.urls;
        if (current.type !== nextSnapshot.type) updates.type = nextSnapshot.type;
        if (current.isClickable !== nextSnapshot.isClickable) updates.isClickable = nextSnapshot.isClickable;

        if (Object.keys(updates).length === 0) return;

        this.snapshot.merge(updates);
    };

    private static areStringArraysEqual(left: string[], right: string[]): boolean {
        if (left === right) return true;
        if (left.length !== right.length) return false;

        for (let i = 0; i < left.length; i += 1) {
            if (left[i] !== right[i]) return false;
        }

        return true;
    }

    private bindRoomListeners(room?: Room): void {
        this.clearRoomListeners();
        if (!room) return;

        room.on(RoomEvent.Name, this.refreshSnapshot);
        room.on(RoomEvent.MyMembership, this.refreshSnapshot);
        room.on(RoomStateEvent.Update, this.refreshSnapshot);
        room.currentState.on(RoomStateEvent.Update, this.refreshSnapshot);
        room.currentState.on(RoomStateEvent.Members, this.refreshSnapshot);
        room.client.on(ClientEvent.AccountData, this.refreshSnapshot);

        this.roomListenersCleanup = (): void => {
            room.off(RoomEvent.Name, this.refreshSnapshot);
            room.off(RoomEvent.MyMembership, this.refreshSnapshot);
            room.off(RoomStateEvent.Update, this.refreshSnapshot);
            room.currentState.off(RoomStateEvent.Update, this.refreshSnapshot);
            room.currentState.off(RoomStateEvent.Members, this.refreshSnapshot);
            room.client.off(ClientEvent.AccountData, this.refreshSnapshot);
        };
    }

    private bindMediaPreviewSettingWatcher(room?: Room): void {
        this.clearMediaPreviewSettingWatcher();
        this.mediaPreviewSettingWatcherRef = SettingsStore.watchSetting(
            "mediaPreviewConfig",
            room?.roomId ?? null,
            this.onMediaPreviewSettingChanged,
        );
    }

    private clearTrackedListeners(): void {
        this.clearRoomListeners();
        this.clearMediaPreviewSettingWatcher();
    }

    private clearRoomListeners(): void {
        this.roomListenersCleanup?.();
        this.roomListenersCleanup = undefined;
    }

    private clearMediaPreviewSettingWatcher(): void {
        SettingsStore.unwatchSetting(this.mediaPreviewSettingWatcherRef);
        this.mediaPreviewSettingWatcherRef = undefined;
    }

    private readonly onMediaPreviewSettingChanged = (): void => {
        this.refreshSnapshot();
    };
}
