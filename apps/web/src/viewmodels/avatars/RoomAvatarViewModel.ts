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
import { arrayHasDiff, filterBoolean } from "../../utils/arrays";
import { MediaPreviewValue } from "../../@types/media_preview";

interface Props {
    /**
     * Room whose avatar data should be rendered.
     */
    room?: Room;
    /**
     * Rendered avatar size in CSS units, used when requesting thumbnail URLs.
     */
    size: string;
    /**
     * Out-of-band room data used when the room object is not available yet.
     */
    oobData?: IOOBData & {
        /**
         * Room ID to use for hash-colour generation before the room exists locally.
         */
        roomId?: string;
    };
    /**
     * Whether clicking the avatar should open the full-size avatar lightbox.
     */
    viewAvatarOnClick?: boolean;
    /**
     * Optional click handler invoked when lightbox behaviour is disabled.
     */
    onClick?: () => void;
    /**
     * Optional shape override. When omitted, the VM derives the shape from the room type.
     */
    type?: "round" | "square";
    /**
     * Optional additional CSS class names applied to the avatar element.
     */
    className?: string;
    /**
     * Accessible label announced by assistive technologies.
     */
    altText?: string;
    /**
     * Browser tooltip shown on hover.
     */
    title?: string;
    /**
     * Tab index forwarded to the avatar element.
     */
    tabIndex?: number;
    /**
     * ARIA role override for the avatar element.
     */
    role?: RoomAvatarViewSnapshot["role"];
    /**
     * Whether to hide the avatar from the accessibility tree.
     */
    ariaHidden?: boolean;
}

type ViewProps = Pick<Props, "size" | "className" | "altText" | "title" | "tabIndex" | "role" | "ariaHidden">;

export class RoomAvatarViewModel
    extends BaseViewModel<RoomAvatarViewSnapshot, Props>
    implements RoomAvatarViewModelInterface
{
    private readonly roomsWithListeners = new WeakSet<Room>();
    private readonly mediaPreviewSettingRoomIdsWithWatchers = new Set<string | null>();

    public constructor(props: Props) {
        super(props, RoomAvatarViewModel.computeSnapshot(props));
        this.bindRoomListeners(props.room);
        this.bindMediaPreviewSettingWatcher(props.room);
    }

    public setRoom(room?: Room): void {
        this.props = { ...this.props, room };
        this.bindRoomListeners(room);
        this.bindMediaPreviewSettingWatcher(room);
        this.refreshSnapshot();
    }

    public setViewProps(viewProps: ViewProps): void {
        this.props = { ...this.props, ...viewProps };
        this.refreshSnapshot();
    }

    public setOobData(oobData?: IOOBData & { roomId?: string }): void {
        this.props = { ...this.props, oobData };
        this.refreshSnapshot();
    }

    public setViewAvatarOnClick(viewAvatarOnClick?: boolean): void {
        this.props = { ...this.props, viewAvatarOnClick };
        this.refreshSnapshot();
    }

    public setOnClick(onClick?: () => void): void {
        this.props = { ...this.props, onClick };
        this.refreshSnapshot();
    }

    public setType(type?: "round" | "square"): void {
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
            size: props.size,
            name: RoomAvatarViewModel.computeName(props.room, props.oobData),
            idName: RoomAvatarViewModel.computeIdName(props.room, props.oobData),
            urls,
            type: RoomAvatarViewModel.computeType(props),
            isClickable: Boolean(props.onClick || (props.viewAvatarOnClick && urls[0])),
            className: props.className,
            altText: props.altText,
            title: props.title,
            tabIndex: props.tabIndex,
            role: props.role,
            ariaHidden: props.ariaHidden,
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
                props.room?.currentState.getStateEvents(EventType.RoomAvatar, "")?.getContent<RoomAvatarEventContent>()
                    .url,
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

        this.snapshot.merge({
            ...nextSnapshot,
            urls: arrayHasDiff(current.urls, nextSnapshot.urls) ? nextSnapshot.urls : current.urls,
        });
    };

    private bindRoomListeners(room?: Room): void {
        if (!room || this.roomsWithListeners.has(room)) return;

        this.roomsWithListeners.add(room);
        const refreshSnapshotForRoom = (): void => {
            if (this.props.room !== room) return;
            this.refreshSnapshot();
        };

        this.disposables.trackListener(room, RoomEvent.Name, refreshSnapshotForRoom);
        this.disposables.trackListener(room, RoomEvent.MyMembership, refreshSnapshotForRoom);
        this.disposables.trackListener(room, RoomStateEvent.Update, refreshSnapshotForRoom);
        this.disposables.trackListener(room.currentState, RoomStateEvent.Update, refreshSnapshotForRoom);
        this.disposables.trackListener(room.currentState, RoomStateEvent.Members, refreshSnapshotForRoom);
        this.disposables.trackListener(room.client, ClientEvent.AccountData, refreshSnapshotForRoom);
    }

    private bindMediaPreviewSettingWatcher(room?: Room): void {
        const roomId = room?.roomId ?? null;
        if (this.mediaPreviewSettingRoomIdsWithWatchers.has(roomId)) return;

        this.mediaPreviewSettingRoomIdsWithWatchers.add(roomId);
        const mediaPreviewSettingWatcherRef = SettingsStore.watchSetting("mediaPreviewConfig", roomId, () => {
            if ((this.props.room?.roomId ?? null) !== roomId) return;
            this.refreshSnapshot();
        });
        this.disposables.track(() => SettingsStore.unwatchSetting(mediaPreviewSettingWatcherRef));
    }
}
