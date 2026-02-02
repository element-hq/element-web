/*
Copyright 2026

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MatrixEvent, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";

import ImageView from "../elements/ImageView";
import Spinner from "../elements/Spinner";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";

type Props = {
    initialEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    thumbnailInfo?: {
        positionX: number;
        positionY: number;
        width: number;
        height: number;
    };
    onFinished(): void;
};

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

function getTimelineEvents(t: any, initialEvent: MatrixEvent): MatrixEvent[] {
    const events: MatrixEvent[] = (t?.getEvents?.() as MatrixEvent[]) ?? [];
    // If timeline isn't ready or empty, fall back to initial event so we can still render
    return events.length ? events : [initialEvent];
}

function computeImageEventsFromTimeline(t: any, initialEvent: MatrixEvent): MatrixEvent[] {
    const events = getTimelineEvents(t, initialEvent);
    return events.filter(isImageEvent);
}

export default function NavigableImageViewDialog(props: Props): React.ReactNode {
    const client = MatrixClientPeg.safeGet();
    const roomId = props.initialEvent.getRoomId();
    const room = roomId ? client.getRoom(roomId) : null;

    const [timeline, setTimeline] = useState<any | null>(null);
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
    }, [props.initialEvent]);

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
        return i >= 0 ? i : 0;
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

    const hasPrev = !(index === 0 && atStartOfRoomImages);
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
    const [src, setSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const helperRef = useRef<MediaEventHelper | null>(null);

    useEffect(() => {
        let cancelled = false;

        // Destroy previous helper
        helperRef.current?.destroy();

        const helper = new MediaEventHelper(currentEvent);
        helperRef.current = helper;

        setLoading(true);
        setSrc(null);

        (async () => {
            try {
                const resolved = (await helper.sourceUrl.value) ?? (await helper.thumbnailUrl.value);
                if (!cancelled) {
                    setSrc(resolved);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setSrc(null);
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            helper.destroy();
            if (helperRef.current === helper) helperRef.current = null;
        };
    }, [currentEvent]);

    if (!timelineReady) {
        return (
            <div className="mx_ImageView">
                <Spinner size={32} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mx_ImageView">
                <Spinner size={32} />
            </div>
        );
    }

    if (!src) {
        return (
            <div className="mx_ImageView">
                <div style={{ color: "white", padding: 16 }}>{_t("timeline|m.image|error")}</div>
            </div>
        );
    }

    return (
        <ImageView
            src={src}
            name={eventToName(currentEvent)}
            mxEvent={currentEvent}
            permalinkCreator={props.permalinkCreator}
            thumbnailInfo={index === 0 ? props.thumbnailInfo : undefined}
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
