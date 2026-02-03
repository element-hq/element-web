/*
Copyright 2026

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MatrixEvent, type EventTimeline, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";

import ImageView from "../elements/ImageView";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";

type Props = Readonly<{
    initialEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    thumbnailInfo?: {
        positionX: number;
        positionY: number;
        width: number;
        height: number;
    };
    initialSrc: string;
    initialName?: string;
    onFinished(): void;
}>;

function isImageEvent(ev: MatrixEvent): boolean {
    if (!ev || ev.isRedacted()) return false;
    if (ev.getType() !== EventType.RoomMessage) return false;
    const c = ev.getContent<ImageContent>();
    return c?.msgtype === MsgType.Image;
}

function eventToName(ev: MatrixEvent): string {
    const content = ev.getContent<ImageContent>();
    return content?.body && content.body.length > 0 ? content.body : _t("common|attachment");
}

function getTimelineEvents(t: EventTimeline | null, initialEvent: MatrixEvent): MatrixEvent[] {
    const events: MatrixEvent[] = (t?.getEvents?.() as MatrixEvent[]) ?? [];
    // If timeline isn't ready or empty, fall back to initial event so we can still render
    return events.length ? events : [initialEvent];
}

function computeImageEventsFromTimeline(t: EventTimeline | null, initialEvent: MatrixEvent): MatrixEvent[] {
    const events = getTimelineEvents(t, initialEvent);
    return events.filter(isImageEvent);
}

export default function NavigableImageViewDialog(props: Props): React.ReactNode {
    const client = MatrixClientPeg.safeGet();
    const roomId = props.initialEvent.getRoomId();
    const room = roomId ? client.getRoom(roomId) : null;

    const [timeline, setTimeline] = useState<EventTimeline | null>(null);
    const [timelineReady, setTimelineReady] = useState(false);

    const [canPaginateBackwards, setCanPaginateBackwards] = useState(true);
    const [atStartOfRoomImages, setAtStartOfRoomImages] = useState(false);

    // Track the currently-viewed event by id so the index can be re-derived after pagination.
    const [currentEventId, setCurrentEventId] = useState<string | null>(props.initialEvent.getId() ?? null);

    const [images, setImages] = useState<MatrixEvent[]>([]);

    // Reset navigation-related state when opening a different initial event.
    useEffect(() => {
        setCurrentEventId(props.initialEvent.getId() ?? null);
        setCanPaginateBackwards(true);
        setAtStartOfRoomImages(false);
        setSrc(props.initialSrc);
    }, [props.initialEvent, props.initialSrc]);

    useEffect(() => {
        let cancelled = false;

        setTimelineReady(false);
        setTimeline(null);
        setCanPaginateBackwards(true);
        setAtStartOfRoomImages(false);

        (async () => {
            if (!room) {
                if (!cancelled) {
                    setTimeline(null);
                    setTimelineReady(true);
                }
                return;
            }

            const timelineSet = room.getUnfilteredTimelineSet?.();
            const evId = props.initialEvent.getId();

            if (!timelineSet || !evId) {
                if (!cancelled) {
                    setTimeline(null);
                    setTimelineReady(true);
                }
                return;
            }

            try {
                // Get a timeline that actually contains the event
                const t = await client.getEventTimeline(timelineSet, evId);
                if (!cancelled) {
                    setTimeline(t);
                    setTimelineReady(true);
                }
            } catch {
                // Fallback: use live timeline if event timeline cannot be obtained.
                if (!cancelled) {
                    const live = timelineSet.getLiveTimeline?.() ?? null;
                    setTimeline(live);
                    setTimelineReady(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [client, room, props.initialEvent]);

    // Refresh images once timeline is ready or changes.
    useEffect(() => {
        if (!timelineReady) return;
        setImages(computeImageEventsFromTimeline(timeline, props.initialEvent));
    }, [timeline, timelineReady, props.initialEvent]);

    const index = useMemo(() => {
        if (!currentEventId) return 0;
        const i = images.findIndex((e) => e.getId() === currentEventId);
        return Math.max(i, 0);
    }, [images, currentEventId]);

    const currentEvent = images[index] ?? props.initialEvent;

    useEffect(() => {
        const id = currentEvent.getId() ?? null;
        setCurrentEventId((prev) => (prev === id ? prev : id));
    }, [currentEvent, setCurrentEventId]);

    const [isPaginating, setIsPaginating] = useState(false);

    const paginateBackwards = useCallback(async (): Promise<boolean> => {
        if (!timeline || isPaginating || !canPaginateBackwards) return false;

        setIsPaginating(true);
        try {
            const ok = await client.paginateEventTimeline(timeline, { backwards: true, limit: 50 });
            setCanPaginateBackwards(Boolean(ok));
            return Boolean(ok);
        } finally {
            setIsPaginating(false);
        }
    }, [client, timeline, isPaginating, canPaginateBackwards]);

    // Only show "Back" if:
    // we have a previous image in the currently known list, or
    // we have a real timeline and can paginate further backwards (meaning "Back" can actually do something)
    const hasPrev = index > 0 || (Boolean(timeline) && canPaginateBackwards && !atStartOfRoomImages);

    // Only show "Next" if we have a next image in the currently known list
    const hasNext = index < images.length - 1;

    const onPrev = useCallback(async () => {
        if (isPaginating) return;

        if (index > 0) {
            setCurrentEventId(images[index - 1].getId() ?? null);
            setAtStartOfRoomImages(false);
            return;
        }

        if (!timeline) return;

        const curId = currentEvent.getId();
        if (!curId) return;

        // If we already know there is no more history, we're at the first image.
        if (!canPaginateBackwards) {
            setAtStartOfRoomImages(true);
            return;
        }

        const MAX_PAGES = 5;

        // Try paginating backwards until we either find an earlier image
        // or determine that we're at the start of the room history.
        for (let page = 0; page < MAX_PAGES; page++) {
            const ok = await paginateBackwards();
            if (!ok) {
                setAtStartOfRoomImages(true);
                return;
            }

            const refreshed = computeImageEventsFromTimeline(timeline, props.initialEvent);
            const newIndex = refreshed.findIndex((e) => e.getId() === curId);

            setImages(refreshed);

            if (newIndex > 0) {
                setCurrentEventId(refreshed[newIndex - 1].getId() ?? null);
                setAtStartOfRoomImages(false);
                return;
            }
            if (newIndex === -1) return;
            // else newIndex === 0: still no earlier image, paginate again
        }

        // We paginated a few pages but didn't find an earlier image yet.
        // Leave state unchanged; another click can paginate further if needed.
    }, [
        isPaginating,
        index,
        images,
        timeline,
        currentEvent,
        canPaginateBackwards,
        paginateBackwards,
        props.initialEvent,
    ]);

    const onNext = useCallback(() => {
        if (index < images.length - 1) {
            setCurrentEventId(images[index + 1].getId() ?? null);
            setAtStartOfRoomImages(false);
        }
    }, [index, images]);

    // Resolve src via MediaEventHelper
    const [src, setSrc] = useState<string | null>(props.initialSrc);

    const helperRef = useRef<MediaEventHelper | null>(null);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        // Destroy previous helper
        helperRef.current?.destroy();
        const helper = new MediaEventHelper(currentEvent);
        helperRef.current = helper;

        (async () => {
            try {
                const resolved =
                    (await helper.sourceUrl.value) ?? (await helper.thumbnailUrl.value) ?? props.initialSrc;

                if (!cancelled) {
                    setSrc(resolved);
                }
            } catch {
                if (!cancelled) {
                    setSrc(props.initialSrc);
                }
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
            helper.destroy();
            if (helperRef.current === helper) helperRef.current = null;
        };
    }, [currentEvent, props.initialSrc]);

    const isInitial = currentEvent.getId() === props.initialEvent.getId();
    return (
        <ImageView
            src={src ?? props.initialSrc}
            name={eventToName(currentEvent) ?? props.initialName}
            mxEvent={currentEvent}
            permalinkCreator={props.permalinkCreator}
            thumbnailInfo={isInitial ? props.thumbnailInfo : undefined}
            onFinished={() => {
                // Clean up any remaining object URLs before closing
                helperRef.current?.destroy();
                helperRef.current = null;
                props.onFinished();
            }}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={onPrev}
            onNext={onNext}
        />
    );
}
