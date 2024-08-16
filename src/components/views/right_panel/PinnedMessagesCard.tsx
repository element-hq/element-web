/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useCallback, useEffect, useState, JSX } from "react";
import {
    Room,
    RoomEvent,
    RoomStateEvent,
    MatrixEvent,
    EventType,
    RelationType,
    EventTimeline,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { Button, Separator } from "@vector-im/compound-web";
import classNames from "classnames";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin";

import { _t } from "../../../languageHandler";
import BaseCard from "./BaseCard";
import Spinner from "../elements/Spinner";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import PinningUtils from "../../../utils/PinningUtils";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { PinnedEventTile } from "../rooms/PinnedEventTile";
import { useRoomState } from "../../../hooks/useRoomState";
import RoomContext, { TimelineRenderingType, useRoomContext } from "../../../contexts/RoomContext";
import { ReadPinsEventId } from "./types";
import Heading from "../typography/Heading";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { filterBoolean } from "../../../utils/arrays";
import Modal from "../../../Modal";
import { UnpinAllDialog } from "../dialogs/UnpinAllDialog";
import EmptyState from "./EmptyState";

/**
 * Get the pinned event IDs from a room.
 * @param room
 */
function getPinnedEventIds(room?: Room): string[] {
    return (
        room
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents(EventType.RoomPinnedEvents, "")
            ?.getContent()?.pinned ?? []
    );
}

/**
 * Get the pinned event IDs from a room.
 * @param room
 */
export const usePinnedEvents = (room?: Room): string[] => {
    const [pinnedEvents, setPinnedEvents] = useState<string[]>(getPinnedEventIds(room));

    // Update the pinned events when the room state changes
    // Filter out events that are not pinned events
    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (ev && ev.getType() !== EventType.RoomPinnedEvents) return;
            setPinnedEvents(getPinnedEventIds(room));
        },
        [room],
    );

    useTypedEventEmitter(room?.getLiveTimeline().getState(EventTimeline.FORWARDS), RoomStateEvent.Events, update);
    useEffect(() => {
        setPinnedEvents(getPinnedEventIds(room));
        return () => {
            setPinnedEvents([]);
        };
    }, [room]);
    return pinnedEvents;
};

/**
 * Get the read pinned event IDs from a room.
 * @param room
 */
function getReadPinnedEventIds(room?: Room): Set<string> {
    return new Set(room?.getAccountData(ReadPinsEventId)?.getContent()?.event_ids ?? []);
}

/**
 * Get the read pinned event IDs from a room.
 * @param room
 */
export const useReadPinnedEvents = (room?: Room): Set<string> => {
    const [readPinnedEvents, setReadPinnedEvents] = useState<Set<string>>(new Set());

    // Update the read pinned events when the room state changes
    // Filter out events that are not read pinned events
    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (ev && ev.getType() !== ReadPinsEventId) return;
            setReadPinnedEvents(getReadPinnedEventIds(room));
        },
        [room],
    );

    useTypedEventEmitter(room, RoomEvent.AccountData, update);
    useEffect(() => {
        setReadPinnedEvents(getReadPinnedEventIds(room));
        return () => {
            setReadPinnedEvents(new Set());
        };
    }, [room]);
    return readPinnedEvents;
};

/**
 * Fetch the pinned events
 * @param room
 * @param pinnedEventIds
 */
function useFetchedPinnedEvents(room: Room, pinnedEventIds: string[]): Array<MatrixEvent | null> | null {
    const cli = useMatrixClientContext();

    return useAsyncMemo(
        () => {
            const promises = pinnedEventIds.map(async (eventId): Promise<MatrixEvent | null> => {
                const timelineSet = room.getUnfilteredTimelineSet();
                // Get the event from the local timeline
                const localEvent = timelineSet
                    ?.getTimelineForEvent(eventId)
                    ?.getEvents()
                    .find((e) => e.getId() === eventId);

                // Decrypt the event if it's encrypted
                // Can happen when the tab is refreshed and the pinned events card is opened directly
                if (localEvent?.isEncrypted()) {
                    await cli.decryptEventIfNeeded(localEvent);
                }

                // If the event is available locally, return it if it's pinnable
                // Otherwise, return null
                if (localEvent) return PinningUtils.isPinnable(localEvent) ? localEvent : null;

                try {
                    // The event is not available locally, so we fetch the event and latest edit in parallel
                    const [
                        evJson,
                        {
                            events: [edit],
                        },
                    ] = await Promise.all([
                        cli.fetchRoomEvent(room.roomId, eventId),
                        cli.relations(room.roomId, eventId, RelationType.Replace, null, { limit: 1 }),
                    ]);

                    const event = new MatrixEvent(evJson);

                    // Decrypt the event if it's encrypted
                    if (event.isEncrypted()) {
                        await cli.decryptEventIfNeeded(event);
                    }

                    // Handle poll events
                    await room.processPollEvents([event]);

                    const senderUserId = event.getSender();
                    if (senderUserId && PinningUtils.isPinnable(event)) {
                        // Inject sender information
                        event.sender = room.getMember(senderUserId);
                        // Also inject any edits we've found
                        if (edit) event.makeReplaced(edit);

                        return event;
                    }
                } catch (err) {
                    logger.error("Error looking up pinned event " + eventId + " in room " + room.roomId);
                    logger.error(err);
                }
                return null;
            });

            return Promise.all(promises);
        },
        [cli, room, pinnedEventIds],
        null,
    );
}

/**
 * List the pinned messages in a room inside a Card.
 */
interface PinnedMessagesCardProps {
    /**
     * The room to list the pinned messages for.
     */
    room: Room;
    /**
     * Permalink of the room.
     */
    permalinkCreator: RoomPermalinkCreator;
    /**
     * Callback for when the card is closed.
     */
    onClose(): void;
}

export function PinnedMessagesCard({ room, onClose, permalinkCreator }: PinnedMessagesCardProps): JSX.Element {
    const cli = useMatrixClientContext();
    const roomContext = useRoomContext();
    const pinnedEventIds = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);
    const pinnedEvents = useFetchedPinnedEvents(room, pinnedEventIds);

    useEffect(() => {
        if (!cli || cli.isGuest()) return; // nothing to do
        const newlyRead = pinnedEventIds.filter((id) => !readPinnedEvents.has(id));
        if (newlyRead.length > 0) {
            // clear out any read pinned events which no longer are pinned
            cli.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: pinnedEventIds,
            });
        }
    }, [cli, room.roomId, pinnedEventIds, readPinnedEvents]);

    let content: JSX.Element;
    if (!pinnedEventIds.length) {
        content = (
            <EmptyState
                Icon={PinIcon}
                title={_t("right_panel|pinned_messages|empty_title")}
                description={_t("right_panel|pinned_messages|empty_description", {
                    pinAction: _t("action|pin"),
                })}
            />
        );
    } else if (pinnedEvents?.length) {
        content = (
            <PinnedMessages events={filterBoolean(pinnedEvents)} room={room} permalinkCreator={permalinkCreator} />
        );
    } else {
        content = <Spinner />;
    }

    return (
        <BaseCard
            header={
                <div className="mx_BaseCard_header_title">
                    <Heading size="4" className="mx_BaseCard_header_title_heading">
                        {_t("right_panel|pinned_messages|header", { count: pinnedEventIds.length })}
                    </Heading>
                </div>
            }
            className="mx_PinnedMessagesCard"
            onClose={onClose}
        >
            <RoomContext.Provider
                value={{
                    ...roomContext,
                    timelineRenderingType: TimelineRenderingType.Pinned,
                }}
            >
                {content}
            </RoomContext.Provider>
        </BaseCard>
    );
}

/**
 * The pinned messages in a room.
 */
interface PinnedMessagesProps {
    /**
     * The pinned events.
     */
    events: MatrixEvent[];
    /**
     * The room the events are in.
     */
    room: Room;
    /**
     * The permalink creator to use.
     */
    permalinkCreator: RoomPermalinkCreator;
}

/**
 * The pinned messages in a room.
 */
function PinnedMessages({ events, room, permalinkCreator }: PinnedMessagesProps): JSX.Element {
    const matrixClient = useMatrixClientContext();

    /**
     * Whether the client can unpin events from the room.
     */
    const canUnpin = useRoomState(room, (state) =>
        state.mayClientSendStateEvent(EventType.RoomPinnedEvents, matrixClient),
    );

    /**
     * Opens the unpin all dialog.
     */
    const onUnpinAll = useCallback(async (): Promise<void> => {
        Modal.createDialog(UnpinAllDialog, {
            roomId: room.roomId,
            matrixClient,
        });
    }, [room, matrixClient]);

    return (
        <>
            <div
                className={classNames("mx_PinnedMessagesCard_wrapper", {
                    mx_PinnedMessagesCard_wrapper_unpin_all: canUnpin,
                })}
                role="list"
            >
                {events.reverse().map((event, i) => (
                    <>
                        <PinnedEventTile
                            key={event.getId()}
                            event={event}
                            permalinkCreator={permalinkCreator}
                            room={room}
                        />
                        {/* Add a separator if this isn't the last pinned message */}
                        {events.length - 1 !== i && (
                            <Separator key={`separator-${event.getId()}`} className="mx_PinnedMessagesCard_Separator" />
                        )}
                    </>
                ))}
            </div>
            {canUnpin && (
                <div className="mx_PinnedMessagesCard_unpin">
                    <Button kind="tertiary" onClick={onUnpinAll}>
                        {_t("right_panel|pinned_messages|unpin_all|button")}
                    </Button>
                </div>
            )}
        </>
    );
}
