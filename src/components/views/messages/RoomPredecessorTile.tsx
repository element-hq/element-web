/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixEvent, type Room, type RoomState } from "matrix-js-sdk/src/matrix";

import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import EventTileBubble from "./EventTileBubble";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { useRoomState } from "../../../hooks/useRoomState";
import SettingsStore from "../../../settings/SettingsStore";
import MatrixToPermalinkConstructor from "../../../utils/permalinks/MatrixToPermalinkConstructor";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";

interface IProps {
    /** The m.room.create MatrixEvent that this tile represents */
    mxEvent: MatrixEvent;
    timestamp?: JSX.Element;
}

/**
 * A message tile showing that this room was created as an upgrade of a previous
 * room.
 */
export const RoomPredecessorTile: React.FC<IProps> = ({ mxEvent, timestamp }) => {
    const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");

    // Note: we ask the room for its predecessor here, instead of directly using
    // the information inside mxEvent. This allows us the flexibility later to
    // use a different predecessor (e.g. through MSC3946) and still display it
    // in the timeline location of the create event.
    const roomContext = useScopedRoomContext("room");
    const predecessor = useRoomState(
        roomContext.room,
        useCallback(
            (state: RoomState) => state.findPredecessor(msc3946ProcessDynamicPredecessor),
            [msc3946ProcessDynamicPredecessor],
        ),
    );

    const onLinkClicked = useCallback(
        (e: React.MouseEvent): void => {
            e.preventDefault();

            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: predecessor?.eventId,
                highlighted: true,
                room_id: predecessor?.roomId,
                metricsTrigger: "Predecessor",
                metricsViaKeyboard: e.type !== "click",
            });
        },
        [predecessor?.eventId, predecessor?.roomId],
    );

    if (!roomContext.room || roomContext.room.roomId !== mxEvent.getRoomId()) {
        logger.warn(
            "RoomPredecessorTile unexpectedly used outside of the context of the" +
                "room containing this m.room.create event.",
        );
        return <></>;
    }

    if (!predecessor) {
        logger.warn("RoomPredecessorTile unexpectedly used in a room with no predecessor.");
        return <div />;
    }

    const prevRoom = MatrixClientPeg.safeGet().getRoom(predecessor.roomId);

    // We need either the previous room, or some servers to find it with.
    // Otherwise, we must bail out here
    if (!prevRoom && !predecessor.viaServers) {
        logger.warn(`Failed to find predecessor room with id ${predecessor.roomId}`);

        const guessedLink = guessLinkForRoomId(predecessor.roomId);

        return (
            <EventTileBubble
                className="mx_CreateEvent"
                title={_t("timeline|m.room.create|continuation")}
                timestamp={timestamp}
            >
                <div className="mx_EventTile_body">
                    <span className="mx_EventTile_tileError">
                        {!!guessedLink ? (
                            <>
                                {_t("timeline|m.room.create|unknown_predecessor_guess_server", {
                                    roomId: predecessor.roomId,
                                })}
                                <a href={guessedLink}>{guessedLink}</a>
                            </>
                        ) : (
                            _t("timeline|m.room.create|unknown_predecessor", {
                                roomId: predecessor.roomId,
                            })
                        )}
                    </span>
                </div>
            </EventTileBubble>
        );
    }
    // Otherwise, we expect to be able to find this room either because it is
    // already loaded, or because we have via_servers that we can use.
    // So we go ahead with rendering the tile.

    const predecessorPermalink = prevRoom
        ? createLinkWithRoom(prevRoom, predecessor.roomId, predecessor.eventId)
        : createLinkWithoutRoom(predecessor.roomId, predecessor?.viaServers ?? [], predecessor.eventId);

    const link = (
        <a href={predecessorPermalink} onClick={onLinkClicked}>
            {_t("timeline|m.room.create|see_older_messages")}
        </a>
    );

    return (
        <EventTileBubble
            className="mx_CreateEvent"
            title={_t("timeline|m.room.create|continuation")}
            subtitle={link}
            timestamp={timestamp}
        />
    );

    function createLinkWithRoom(room: Room, roomId: string, eventId?: string): string {
        const permalinkCreator = new RoomPermalinkCreator(room, roomId);
        permalinkCreator.load();
        if (eventId) {
            return permalinkCreator.forEvent(eventId);
        } else {
            return permalinkCreator.forRoom();
        }
    }

    function createLinkWithoutRoom(roomId: string, viaServers: string[], eventId?: string): string {
        const matrixToPermalinkConstructor = new MatrixToPermalinkConstructor();
        if (eventId) {
            return matrixToPermalinkConstructor.forEvent(roomId, eventId, viaServers);
        } else {
            return matrixToPermalinkConstructor.forRoom(roomId, viaServers);
        }
    }

    /**
     * Guess the permalink for a room based on its room ID.
     *
     * The spec says that Room IDs are opaque [1] so this can only ever be a
     * guess. There is no guarantee that this room exists on this server.
     *
     * [1] https://spec.matrix.org/v1.5/appendices/#room-ids-and-event-ids
     */
    function guessLinkForRoomId(roomId: string): string | null {
        const serverName = guessServerNameFromRoomId(roomId);
        if (serverName) {
            return new MatrixToPermalinkConstructor().forRoom(roomId, [serverName]);
        } else {
            return null;
        }
    }
};

/**
 * @internal Public for test only
 *
 * Guess the server name for a room based on its room ID.
 *
 * The spec says that Room IDs are opaque [1] so this can only ever be a
 * guess. There is no guarantee that this room exists on this server.
 *
 * [1] https://spec.matrix.org/v1.5/appendices/#room-ids-and-event-ids
 */
export function guessServerNameFromRoomId(roomId: string): string | null {
    const m = roomId.match(/^[^:]*:(.*)/);
    if (m) {
        return m[1];
    } else {
        return null;
    }
}
