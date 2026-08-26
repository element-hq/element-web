/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    Filter,
    MsgType,
    type EventTimelineSet,
    type MatrixClient,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { presentableTextForFile } from "./FileUtils";
import { _t } from "../languageHandler";

/**
 * Build (or reuse) the server-side filtered timeline set containing the room's file messages.
 *
 * Note that the filter matches on `contains_url`, which the server cannot evaluate for encrypted
 * events. In encrypted rooms this set is only populated where a local event index exists, which
 * is why {@link listRoomFiles} falls back to the loaded timeline.
 *
 * @param client - the matrix client
 * @param room - the room whose files are wanted
 */
export async function getFileTimelineSet(client: MatrixClient, room: Room): Promise<EventTimelineSet> {
    const filter = new Filter(client.getSafeUserId());
    filter.setDefinition({
        room: {
            timeline: {
                contains_url: true,
                types: ["m.room.message"],
            },
        },
    });

    filter.filterId = await client.getOrCreateFilter("FILTER_FILES_" + client.credentials.userId, filter);
    return room.getOrCreateFilteredTimelineSet(filter);
}

export interface RoomFile {
    eventId: string;
    /** Presentable filename, including its size where the event declares one. */
    name: string;
    /** Newest first ordering key. */
    ts: number;
}

function toRoomFile(event: MatrixEvent): RoomFile | null {
    if (event.isRedacted()) return null;
    if (event.getContent<MediaEventContent>().msgtype !== MsgType.File) return null;

    const eventId = event.getId();
    if (!eventId) return null;

    return {
        eventId,
        name: presentableTextForFile(event.getContent<MediaEventContent>(), _t("common|attachment"), true),
        ts: event.getTs(),
    };
}

/**
 * List the file attachments in a room, newest first.
 *
 * A room's files are a flat list — unlike a storage provider, there are no folders to descend
 * into, so this returns the files themselves rather than any tree.
 *
 * @param client - the matrix client
 * @param roomId - the room to list
 */
export async function listRoomFiles(client: MatrixClient, roomId: string): Promise<RoomFile[]> {
    const room = client.getRoom(roomId);
    if (!room) return [];

    let events: MatrixEvent[] = [];
    try {
        events = (await getFileTimelineSet(client, room)).getLiveTimeline().getEvents();
    } catch {
        // Falling through to the loaded timeline below is better than showing nothing.
    }

    // The filtered set stays empty in encrypted rooms without a local event index, which is the
    // common case in the browser. Scanning what the client already has loaded is less complete
    // than the server filter but is at least populated.
    if (events.length === 0) {
        events = room.getLiveTimeline().getEvents();
    }

    const files = events.map(toRoomFile).filter((file): file is RoomFile => file !== null);
    files.sort((a, b) => b.ts - a.ts);
    return files;
}
