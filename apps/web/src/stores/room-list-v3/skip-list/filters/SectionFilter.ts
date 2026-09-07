/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { type Filter, type FilterKey } from ".";
import DMRoomMap from "../../../../utils/DMRoomMap";
import { CHATS_TAG } from "../../section";
import { DefaultTagID } from "../tag";

/**
 * Matches the rooms of a single section. A room belongs to exactly one section: the section of the
 * first tag it is tagged with, or, when it has none of those tags, the People section if it is a
 * direct message and the Chats section otherwise.
 *
 * The People section is optional, see the "RoomList.showPeopleSection" setting. When it is absent
 * from the section tags, direct messages go to the Chats section like any other room.
 */
export class SectionFilter implements Filter {
    /**
     * Whether the People section is one of the sections being displayed.
     * Computed once because {@link matches} runs for every room.
     */
    private readonly hasPeopleSection: boolean;

    /**
     * @param tag The tag of the section this filter matches.
     * @param sectionTags All the section tags, in display order.
     */
    public constructor(
        private readonly tag: string,
        private readonly sectionTags: string[],
    ) {
        this.hasPeopleSection = sectionTags.includes(DefaultTagID.DM);
    }

    public matches(room: Room): boolean {
        // A tag the user applied wins over being a direct message.
        const tag = this.sectionTags.find((sectionTag) => room.tags[sectionTag]);
        if (tag) return tag === this.tag;
        const isDm = this.hasPeopleSection && !!DMRoomMap.shared().getUserIdForRoomId(room.roomId);
        return this.tag === (isDm ? DefaultTagID.DM : CHATS_TAG);
    }

    public get key(): FilterKey {
        return this.tag;
    }
}
