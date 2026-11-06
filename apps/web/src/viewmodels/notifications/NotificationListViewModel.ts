/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    ClientEvent,
    Direction,
    type EventTimelineSet,
    type INotificationsResponse,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    Method,
    type Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { noUnsafeEventProps } from "matrix-js-sdk/src/utils";
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
 * which is fed live by the Notifier and back-paginated from /notifications.
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
        if (this.timelineSet?.findEventById(ev.getId()!)) this.update();
    };

    private readonly update = (): void => {
        const events = this.timelineSet?.getLiveTimeline().getEvents() ?? [];
        const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
        const items = groupConsecutive(events.filter((ev) => ev.getId() && ev.getRoomId()).reverse()).map((group) =>
            this.toItem(group, showTwelveHour),
        );
        this.snapshot.merge({ items });
    };

    /**
     * @param group - consecutive events of a sender in a room, newest first
     */
    private toItem(group: MatrixEvent[], showTwelveHour: boolean): NotificationListItem {
        const newest = group[0];
        const roomId = newest.getRoomId()!;
        const preview = MessagePreviewStore.instance.generatePreviewForEvent(newest);
        return {
            // Clicking opens the room at the oldest event, to read the group in order
            id: group[group.length - 1].getId()!,
            roomId,
            roomName: this.props.client.getRoom(roomId)?.name ?? roomId,
            preview: preview ? `${getSenderName(newest)}: ${preview}` : getSenderName(newest),
            timestamp: formatRelativeTime(new Date(newest.getTs()), showTwelveHour),
            isMention: group.some((ev) => this.props.client.getPushActionsForEvent(ev)?.tweaks.highlight),
            count: group.length,
        };
    }

    public loadMore = (): void => {
        if (!this.timelineSet || !this.canLoadMore || this.snapshot.current.isLoading) return;
        this.snapshot.merge({ isLoading: true });
        fetchAllNotifications(this.props.client, this.timelineSet, PAGE_SIZE)
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

/**
 * Group events which directly follow each other in the same room (and thread) from the same sender.
 * @param events - events, newest first
 * @returns the groups, newest first, each with its events newest first
 */
export function groupConsecutive(events: MatrixEvent[]): MatrixEvent[][] {
    const groups: MatrixEvent[][] = [];
    for (const ev of events) {
        const head = groups.at(-1)?.[0];
        if (
            head &&
            head.getRoomId() === ev.getRoomId() &&
            head.getSender() === ev.getSender() &&
            head.threadRootId === ev.threadRootId
        ) {
            groups.at(-1)!.push(ev);
        } else {
            groups.push([ev]);
        }
    }
    return groups;
}

/**
 * Back-paginate the notification timeline set with every notification, not only highlights.
 * Mirrors the notification branch of `MatrixClient.paginateEventTimeline`, which hard-codes `only=highlight`.
 * ponytail: copy of js-sdk code, drop it for `paginateEventTimeline` once the js-sdk can include all notifications
 * @returns whether there are more notifications to fetch
 */
async function fetchAllNotifications(
    client: MatrixClient,
    timelineSet: EventTimelineSet,
    limit: number,
): Promise<boolean> {
    const timeline = timelineSet.getLiveTimeline();
    const from = timeline.getPaginationToken(Direction.Backward);
    const res = await client.http.authedRequest<INotificationsResponse>(Method.Get, "/notifications", {
        limit: limit.toString(),
        ...(from && from !== "end" && { from }),
    });
    const mapper = client.getEventMapper();
    const events = res.notifications.filter(noUnsafeEventProps).map((notification) => {
        const event = mapper(notification.event);
        client.getPushDetailsForEvent(event, true);
        event.event.room_id = notification.room_id;
        return event;
    });
    timelineSet.addEventsToTimeline(events, true, false, timeline, res.next_token);
    if (!res.next_token) timeline.setPaginationToken(null, Direction.Backward);
    return Boolean(res.next_token);
}
