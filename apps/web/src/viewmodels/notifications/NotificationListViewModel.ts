/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    ClientEvent,
    type EventTimelineSet,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    type Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type NotificationListItem,
    type NotificationListViewModel as NotificationListViewModelInterface,
    type NotificationListViewSnapshot,
} from "@element-hq/web-shared-components";

import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import type { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { MessagePreviewStore } from "../../stores/message-preview/MessagePreviewStore";
import { getSenderName } from "../../stores/message-preview/previews/utils";
import { formatRelativeTime } from "../../DateUtils";
import SettingsStore from "../../settings/SettingsStore";

const PAGE_SIZE = 20;

export interface Props {
    /** The Matrix client, which owns the notification timeline set */
    client: MatrixClient;
}

/**
 * View model for the notification list: one item per event of the client's notification timeline set,
 * which is fed live by /sync and back-paginated from /notifications.
 */
export class NotificationListViewModel
    extends BaseViewModel<NotificationListViewSnapshot, Props>
    implements NotificationListViewModelInterface
{
    private readonly timelineSet: EventTimelineSet | null;
    private canLoadMore = true;

    public constructor(props: Props) {
        super(props, { items: [], isLoading: false });
        this.timelineSet = props.client.getNotifTimelineSet();
        const { client } = props;
        client.on(RoomEvent.Timeline, this.onTimeline);
        client.on(RoomEvent.TimelineReset, this.onTimelineReset);
        client.on(MatrixEventEvent.Decrypted, this.onDecrypted);
        client.on(ClientEvent.Room, this.update);
        this.disposables.track(() => {
            client.off(RoomEvent.Timeline, this.onTimeline);
            client.off(RoomEvent.TimelineReset, this.onTimelineReset);
            client.off(MatrixEventEvent.Decrypted, this.onDecrypted);
            client.off(ClientEvent.Room, this.update);
        });
        this.update();
        if (this.snapshot.current.items.length === 0) this.loadMore();
    }

    private readonly onTimeline = (
        _ev: MatrixEvent,
        _room: Room | undefined,
        _toStart: boolean | undefined,
        _removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (data.timeline.getTimelineSet() === this.timelineSet) this.update();
    };

    private readonly onTimelineReset = (_room: Room | undefined, timelineSet: EventTimelineSet): void => {
        if (timelineSet !== this.timelineSet) return;
        this.canLoadMore = true;
        this.update();
    };

    private readonly onDecrypted = (ev: MatrixEvent): void => {
        if (this.snapshot.current.items.some((item) => item.id === ev.getId())) this.update();
    };

    private readonly update = (): void => {
        const events = this.timelineSet?.getLiveTimeline().getEvents() ?? [];
        const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
        const items = events
            .map((ev) => this.toItem(ev, showTwelveHour))
            .filter((item): item is NotificationListItem => item !== null)
            .reverse();
        this.snapshot.merge({ items });
    };

    private toItem(ev: MatrixEvent, showTwelveHour: boolean): NotificationListItem | null {
        const id = ev.getId();
        const roomId = ev.getRoomId();
        if (!id || !roomId) return null;
        const preview = MessagePreviewStore.instance.generatePreviewForEvent(ev);
        return {
            id,
            roomId,
            roomName: this.props.client.getRoom(roomId)?.name ?? roomId,
            preview: preview ? `${getSenderName(ev)}: ${preview}` : getSenderName(ev),
            timestamp: formatRelativeTime(new Date(ev.getTs()), showTwelveHour),
            isMention: Boolean(this.props.client.getPushActionsForEvent(ev)?.tweaks.highlight),
        };
    }

    public loadMore = (): void => {
        if (!this.timelineSet || !this.canLoadMore || this.snapshot.current.isLoading) return;
        this.snapshot.merge({ isLoading: true });
        this.props.client
            .paginateEventTimeline(this.timelineSet.getLiveTimeline(), { backwards: true, limit: PAGE_SIZE })
            .then((hasMore) => {
                this.canLoadMore = hasMore;
            })
            .catch((e) => logger.error("Failed to paginate notifications", e))
            .finally(() => {
                if (this.isDisposed) return;
                this.snapshot.merge({ isLoading: false });
                this.update();
            });
    };

    public onItemClick = (id: string): void => {
        const item = this.snapshot.current.items.find((i) => i.id === id);
        if (!item) return;
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: item.roomId,
            event_id: item.id,
            highlighted: true,
            metricsTrigger: undefined,
        });
    };
}
