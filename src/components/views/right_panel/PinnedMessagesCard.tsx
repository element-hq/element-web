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

import React, { useCallback, useContext, useEffect, useState } from "react";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType, RelationType } from "matrix-js-sdk/src/@types/event";
import { logger } from "matrix-js-sdk/src/logger";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

import { Icon as ContextMenuIcon } from "../../../../res/img/element-icons/context-menu.svg";
import { Icon as EmojiIcon } from "../../../../res/img/element-icons/room/message-bar/emoji.svg";
import { Icon as ReplyIcon } from "../../../../res/img/element-icons/room/message-bar/reply.svg";
import { _t } from "../../../languageHandler";
import BaseCard from "./BaseCard";
import Spinner from "../elements/Spinner";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import PinningUtils from "../../../utils/PinningUtils";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import PinnedEventTile from "../rooms/PinnedEventTile";
import { useRoomState } from "../../../hooks/useRoomState";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { ReadPinsEventId } from "./types";
import Heading from "../typography/Heading";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { filterBoolean } from "../../../utils/arrays";

interface IProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
    onClose(): void;
}

function getPinnedEventIds(room?: Room): string[] {
    return room?.currentState.getStateEvents(EventType.RoomPinnedEvents, "")?.getContent()?.pinned ?? [];
}

export const usePinnedEvents = (room?: Room): string[] => {
    const [pinnedEvents, setPinnedEvents] = useState<string[]>(getPinnedEventIds(room));

    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (ev && ev.getType() !== EventType.RoomPinnedEvents) return;
            setPinnedEvents(getPinnedEventIds(room));
        },
        [room],
    );

    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, update);
    useEffect(() => {
        setPinnedEvents(getPinnedEventIds(room));
        return () => {
            setPinnedEvents([]);
        };
    }, [room]);
    return pinnedEvents;
};

function getReadPinnedEventIds(room?: Room): Set<string> {
    return new Set(room?.getAccountData(ReadPinsEventId)?.getContent()?.event_ids ?? []);
}

export const useReadPinnedEvents = (room?: Room): Set<string> => {
    const [readPinnedEvents, setReadPinnedEvents] = useState<Set<string>>(new Set());

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

const PinnedMessagesCard: React.FC<IProps> = ({ room, onClose, permalinkCreator }) => {
    const cli = useContext(MatrixClientContext);
    const roomContext = useContext(RoomContext);
    const canUnpin = useRoomState(room, (state) => state.mayClientSendStateEvent(EventType.RoomPinnedEvents, cli));
    const pinnedEventIds = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);

    useEffect(() => {
        const newlyRead = pinnedEventIds.filter((id) => !readPinnedEvents.has(id));
        if (newlyRead.length > 0) {
            // clear out any read pinned events which no longer are pinned
            cli?.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: pinnedEventIds,
            });
        }
    }, [cli, room.roomId, pinnedEventIds, readPinnedEvents]);

    const pinnedEvents = useAsyncMemo(
        () => {
            const promises = pinnedEventIds.map(async (eventId): Promise<MatrixEvent | null> => {
                const timelineSet = room.getUnfilteredTimelineSet();
                const localEvent = timelineSet
                    ?.getTimelineForEvent(eventId)
                    ?.getEvents()
                    .find((e) => e.getId() === eventId);
                if (localEvent) return PinningUtils.isPinnable(localEvent) ? localEvent : null;

                try {
                    // Fetch the event and latest edit in parallel
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
                    if (event.isEncrypted()) {
                        await cli.decryptEventIfNeeded(event); // TODO await?
                    }
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

    let content: JSX.Element[] | JSX.Element | undefined;
    if (!pinnedEventIds.length) {
        content = (
            <div className="mx_PinnedMessagesCard_empty_wrapper">
                <div className="mx_PinnedMessagesCard_empty">
                    {/* XXX: We reuse the classes for simplicity, but deliberately not the components for non-interactivity. */}
                    <div className="mx_MessageActionBar mx_PinnedMessagesCard_MessageActionBar">
                        <div className="mx_MessageActionBar_iconButton">
                            <EmojiIcon />
                        </div>
                        <div className="mx_MessageActionBar_iconButton">
                            <ReplyIcon />
                        </div>
                        <div className="mx_MessageActionBar_iconButton mx_MessageActionBar_optionsButton">
                            <ContextMenuIcon />
                        </div>
                    </div>

                    <Heading size="h4" className="mx_PinnedMessagesCard_empty_header">
                        {_t("Nothing pinned, yet")}
                    </Heading>
                    {_t(
                        "If you have permissions, open the menu on any message and select " +
                            "<b>Pin</b> to stick them here.",
                        {},
                        {
                            b: (sub) => <b>{sub}</b>,
                        },
                    )}
                </div>
            </div>
        );
    } else if (pinnedEvents?.length) {
        const onUnpinClicked = async (event: MatrixEvent): Promise<void> => {
            const pinnedEvents = room.currentState.getStateEvents(EventType.RoomPinnedEvents, "");
            if (pinnedEvents?.getContent()?.pinned) {
                const pinned = pinnedEvents.getContent().pinned;
                const index = pinned.indexOf(event.getId());
                if (index !== -1) {
                    pinned.splice(index, 1);
                    await cli.sendStateEvent(room.roomId, EventType.RoomPinnedEvents, { pinned }, "");
                }
            }
        };

        // show them in reverse, with latest pinned at the top
        content = filterBoolean(pinnedEvents)
            .reverse()
            .map((ev) => (
                <PinnedEventTile
                    key={ev.getId()}
                    event={ev}
                    onUnpinClicked={canUnpin ? () => onUnpinClicked(ev) : undefined}
                    permalinkCreator={permalinkCreator}
                />
            ));
    } else {
        content = <Spinner />;
    }

    return (
        <BaseCard
            header={
                <div className="mx_BaseCard_header_title">
                    <Heading size="h4" className="mx_BaseCard_header_title_heading">
                        {_t("Pinned messages")}
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
};

export default PinnedMessagesCard;
