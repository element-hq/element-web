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
import { RoomState } from "matrix-js-sdk/src/models/room-state";
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

    useEventEmitter(room?.currentState, "RoomState.events", update);
    useEffect(() => {
        update();
        return () => {
            setPinnedEvents([]);
        };
    }, [update]);
    return pinnedEvents;
};

export const ReadPinsEventId = "im.vector.room.read_pins";

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

const useRoomState = <T extends any>(room: Room, mapper: (state: RoomState) => T): T => {
    const [value, setValue] = useState<T>(room ? mapper(room.currentState) : undefined);

    const update = useCallback(() => {
        if (!room) return;
        setValue(mapper(room.currentState));
    }, [room, mapper]);

    useEventEmitter(room?.currentState, "RoomState.events", update);
    useEffect(() => {
        update();
        return () => {
            setValue(undefined);
        };
    }, [update]);
    return value;
};

const PinnedMessagesCard = ({ room, onClose }: IProps) => {
    const cli = useContext(MatrixClientContext);
    const canUnpin = useRoomState(room, state => state.mayClientSendStateEvent(EventType.RoomPinnedEvents, cli));
    const pinnedEventIds = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);

    useEffect(() => {
        const newlyRead = pinnedEventIds.filter(id => !readPinnedEvents.has(id));
        if (newlyRead.length > 0) {
            // clear out any read pinned events which no longer are pinned
            cli.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: pinnedEventIds,
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
        let onUnpinClicked;
        if (canUnpin) {
            onUnpinClicked = async (event: MatrixEvent) => {
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
        }

        // show them in reverse, with latest pinned at the top
        content = pinnedEvents.filter(Boolean).reverse().map(ev => (
            <PinnedEventTile key={ev.getId()} room={room} event={ev} onUnpinClicked={() => onUnpinClicked(ev)} />
        ));
    } else {
        content = <div className="mx_PinnedMessagesCard_empty">
            <div>
                { /* XXX: We reuse the classes for simplicity, but deliberately not the components for non-interactivity. */ }
                <div className="mx_PinnedMessagesCard_MessageActionBar">
                    <div className="mx_MessageActionBar_maskButton mx_MessageActionBar_reactButton" />
                    <div className="mx_MessageActionBar_maskButton mx_MessageActionBar_replyButton" />
                    <div className="mx_MessageActionBar_maskButton mx_MessageActionBar_optionsButton" />
                </div>

                <h2>{ _t("Nothing pinned, yet") }</h2>
                { _t("If you have permissions, open the menu on any message and select " +
                    "<b>Pin</b> to stick them here.", {}, {
                        b: sub => <b>{ sub }</b>,
                }) }
            </div>
        </div>;
    }

    return <BaseCard
        header={<h2>{ _t("Pinned messages") }</h2>}
        className="mx_PinnedMessagesCard"
        onClose={onClose}
    >
        { content }
    </BaseCard>;
};

export default PinnedMessagesCard;
