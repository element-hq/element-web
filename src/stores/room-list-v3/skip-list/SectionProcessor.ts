/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomListEntry } from "../RoomListStoreV3.ts";
import { type Filter } from "./filters";
import { FavouriteFilter } from "./filters/FavouriteFilter.ts";
import { InvitesFilter } from "./filters/InvitesFilter.ts";
import { MentionsFilter } from "./filters/MentionsFilter.ts";
import { UnreadFilter } from "./filters/UnreadFilter.ts";
import { LowPriorityFilter } from "./filters/LowPriorityFilter.ts";

const enum RoomListSubsection {
    Favourite,
    Mention,
    Unread,
    Invite,
    LowPriority,
    Chat,
}

const filters: { [key in RoomListSubsection]: Filter | null } = {
    [RoomListSubsection.Favourite]: new FavouriteFilter(),
    [RoomListSubsection.Invite]: new InvitesFilter(),
    [RoomListSubsection.Mention]: new MentionsFilter(),
    [RoomListSubsection.Unread]: new UnreadFilter(),
    [RoomListSubsection.LowPriority]: new LowPriorityFilter(),
    [RoomListSubsection.Chat]: null,
};

const categories = [
    RoomListSubsection.Favourite,
    RoomListSubsection.Invite,
    RoomListSubsection.Mention,
    RoomListSubsection.Unread,
    RoomListSubsection.LowPriority,
    RoomListSubsection.Chat,
];

export enum RoomListSectionKey {
    Favourite = "favourite",
    Unread = "unread",
    Chat = "chat",
    LowPriority = "lowpriority",
}

export class RoomListSectionHeader {
    public constructor(public readonly key: RoomListSectionKey) {}
}

const sections: { header: RoomListSectionHeader; subsections: RoomListSubsection[] }[] = [
    { header: new RoomListSectionHeader(RoomListSectionKey.Favourite), subsections: [RoomListSubsection.Favourite] },
    {
        header: new RoomListSectionHeader(RoomListSectionKey.Unread),
        subsections: [RoomListSubsection.Invite, RoomListSubsection.Mention, RoomListSubsection.Unread],
    },
    { header: new RoomListSectionHeader(RoomListSectionKey.Chat), subsections: [RoomListSubsection.Chat] },
    {
        header: new RoomListSectionHeader(RoomListSectionKey.LowPriority),
        subsections: [RoomListSubsection.LowPriority],
    },
];

export class SectionProcessor {
    public process(rooms: Iterable<Room>): RoomListEntry[] {
        const groupedRooms: { [key in RoomListSubsection]: Room[] } = {
            [RoomListSubsection.Favourite]: [],
            [RoomListSubsection.Invite]: [],
            [RoomListSubsection.Mention]: [],
            [RoomListSubsection.Unread]: [],
            [RoomListSubsection.LowPriority]: [],
            [RoomListSubsection.Chat]: [],
        };

        for (const room of rooms) {
            for (const category of categories) {
                const filter = filters[category];
                if (filter == null || filter.matches(room)) {
                    groupedRooms[category].push(room);
                    break;
                }
            }
        }

        const roomlist: RoomListEntry[] = [];
        for (const section of sections) {
            const rooms: Room[] = [];
            for (const subsection of section.subsections) {
                rooms.push(...groupedRooms[subsection]);
            }
            if (rooms.length) {
                roomlist.push(section.header);
                roomlist.push(...rooms);
            }
        }

        return roomlist;
    }
}
