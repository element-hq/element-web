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

import React, {useCallback, useContext, useEffect, useState} from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from 'matrix-js-sdk/src/@types/event';

import { _t } from "../../../languageHandler";
import BaseCard from "./BaseCard";
import Spinner from "../elements/Spinner";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import PinningUtils from "../../../utils/PinningUtils";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import PinnedEventTile from "../rooms/PinnedEventTile";

interface IProps {
    room: Room;
    onClose(): void;
}

export const usePinnedEvents = (room: Room): string[] => {
    const [pinnedEvents, setPinnedEvents] = useState<string[]>([]);

    const update = useCallback((ev?: MatrixEvent) => {
        if (!room) return;
        if (ev && ev.getType() !== EventType.RoomPinnedEvents) return;
        setPinnedEvents(room.currentState.getStateEvents(EventType.RoomPinnedEvents, "")?.getContent()?.pinned || []);
    }, [room]);

    useEventEmitter(room.currentState, "RoomState.events", update);
    useEffect(() => {
        update();
        return () => {
            setPinnedEvents([]);
        };
    }, [update]);
    return pinnedEvents;
};

const ReadPinsEventId = "im.vector.room.read_pins";
const ReadPinsNumIds = 10;

export const useReadPinnedEvents = (room: Room): Set<string> => {
    const [readPinnedEvents, setReadPinnedEvents] = useState<Set<string>>(new Set());

    const update = useCallback((ev?: MatrixEvent) => {
        if (!room) return;
        if (ev && ev.getType() !== ReadPinsEventId) return;
        const readPins = room.getAccountData(ReadPinsEventId)?.getContent()?.event_ids;
        setReadPinnedEvents(new Set(readPins || []));
    }, [room]);

    useEventEmitter(room, "Room.accountData", update);
    useEffect(() => {
        update();
        return () => {
            setReadPinnedEvents(new Set());
        };
    }, [update]);
    return readPinnedEvents;
};

const PinnedMessagesCard = ({ room, onClose }: IProps) => {
    const cli = useContext(MatrixClientContext);
    const pinnedEventIds = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);

    useEffect(() => {
        const newlyRead = pinnedEventIds.filter(id => !readPinnedEvents.has(id));
        if (newlyRead.length > 0) {
            // Only keep the last N event IDs to avoid infinite growth
            cli.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: [
                    ...newlyRead.reverse(),
                    ...readPinnedEvents,
                ].splice(0, ReadPinsNumIds),
            });
        }
    }, [cli, room.roomId, pinnedEventIds, readPinnedEvents]);

    const pinnedEvents = useAsyncMemo(() => {
        const promises = pinnedEventIds.map(async eventId => {
            const timelineSet = room.getUnfilteredTimelineSet();
            const localEvent = timelineSet?.getTimelineForEvent(eventId)?.getEvents().find(e => e.getId() === eventId);
            if (localEvent) return localEvent;

            try {
                const evJson = await cli.fetchRoomEvent(room.roomId, eventId);
                const event = new MatrixEvent(evJson);
                if (event.isEncrypted()) {
                    await cli.decryptEventIfNeeded(event); // TODO await?
                }
                if (event && PinningUtils.isPinnable(event)) {
                    return event;
                }
            } catch (err) {
                console.error("Error looking up pinned event " + eventId + " in room " + room.roomId);
                console.error(err);
            }
            return null;
        });

        return Promise.all(promises);
    }, [cli, room, pinnedEventIds], null);

    let content;
    if (!pinnedEvents) {
        content = <Spinner />;
    } else if (pinnedEvents.length > 0) {
        content = pinnedEvents.filter(Boolean).map(ev => (
            <PinnedEventTile
                key={ev.getId()}
                mxRoom={room}
                mxEvent={ev}
                onUnpinned={() => {}}
            />
        ));
    } else {
        content = <div className="mx_RightPanel_empty mx_NotificationPanel_empty">
            <h2>{_t("You’re all caught up")}</h2>
            <p>{_t("You have no visible notifications.")}</p>
        </div>;
    }

    return <BaseCard className="mx_NotificationPanel" onClose={onClose} withoutScrollContainer>
        { content }
    </BaseCard>;
};

export default PinnedMessagesCard;
