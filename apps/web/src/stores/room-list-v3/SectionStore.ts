/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { ExcludeTagsFilter } from "./skip-list/filters/ExcludeTagsFilter";
import { TagFilter } from "./skip-list/filters/TagFilter";
import { RoomSkipList } from "./skip-list/RoomSkipList";
import { type SortingAlgorithm, type Sorter } from "./skip-list/sorters";
import { DefaultTagID } from "./skip-list/tag";
import { type FilterKey, type Filter } from "./skip-list/filters";
import { filterBoolean } from "../../utils/arrays";

/**
 * Represents a named section of rooms in the room list, identified by a tag.
 */
export interface Section {
    /** The tag that identifies this section. */
    tag: string;
    /** The ordered list of rooms belonging to this section. */
    rooms: Room[];
}

/**
 * A synthetic tag used to represent the "Chats" section, which contains
 * every room that does not belong to any other explicit tag section.
 */
export const CHATS_TAG = "chats";

/**
 * Manages an ordered collection of {@link RoomSkipList}s, one per tag section,
 * and exposes a unified API for seeding, mutating, and querying the room list.
 *
 * Each section is backed by a {@link RoomSkipList} that keeps rooms sorted
 * according to the active {@link Sorter} and filtered by the section-specific
 * {@link Filter} as well as any additional filters supplied at construction time.
 */
export class SectionStore {
    /**
     * Maps section tags to their corresponding skip lists.
     */
    private roomSkipListByTag: Map<string, RoomSkipList> = new Map();
    /**
     * Maps section tags to their corresponding tag filters, used to determine which rooms belong in which sections.
     */
    private filterByTag: Map<string, Filter> = new Map();

    /**
     * Defines the display order of sections.
     */
    private sortedTags: string[] = [DefaultTagID.Favourite, CHATS_TAG, DefaultTagID.LowPriority];

    /**
     * Creates a new `SectionStore`.
     *
     * @param sorter - The sorting algorithm used to order rooms within each section.
     * @param filters - Additional filters applied on top of each section's built-in tag filter.
     */
    public constructor(
        private sorter: Sorter,
        filters: Filter[],
    ) {
        const tagsToExclude = this.sortedTags.filter((tag) => tag !== CHATS_TAG);
        this.sortedTags.forEach((tag) => {
            const filter = tag === CHATS_TAG ? new ExcludeTagsFilter(tagsToExclude) : new TagFilter(tag);
            this.filterByTag.set(tag, filter);
            this.roomSkipListByTag.set(tag, new RoomSkipList(sorter, [filter, ...filters]));
        });
    }

    /**
     * Whether every section's underlying skip list has been seeded and is ready
     * to serve room data. Returns `false` if any section has not yet been initialized.
     */
    public get initialized(): boolean {
        return this.sortedTags.every((tag) => this.roomSkipListByTag.get(tag)?.initialized);
    }

    /**
     * Seeds all section skip lists with an initial set of rooms.
     * Each room is placed into whichever sections its tags qualify it for.
     * Must be called before any mutation methods.
     *
     * @param rooms - The full list of rooms to seed the store with.
     */
    public seed(rooms: Room[]): void {
        console.log("Seeding section store with rooms", rooms);
        this.runOnAllList((list) => list.seed(rooms));
    }

    /**
     * Replaces the active sorter and rebuilds all section skip lists from scratch.
     *
     * @param sorter - The new sorting algorithm to use.
     * @param rooms - The full list of rooms used to re-seed the store after the sorter change.
     */
    public useNewSorter(sorter: Sorter, rooms: Room[]): void {
        this.roomSkipListByTag.forEach((skipList) => skipList.useNewSorter(sorter, rooms));
    }

    /**
     * The currently active sorting algorithm.
     */
    public get activeSortAlgorithm(): SortingAlgorithm {
        return this.sorter.type;
    }

    /**
     * Re-evaluates the active space membership for every room node across all
     * section skip lists. Should be called whenever the active space changes so
     * that space-filtered queries return up-to-date results.
     */
    public calculateActiveSpaceForNodes(): void {
        this.runOnAllList((list) => list.calculateActiveSpaceForNodes());
    }

    /**
     * Inserts a newly joined room into all relevant section skip lists.
     * Throws if the room is already present in any skip list.
     *
     * @param room - The room to add.
     */
    public addNewRoom(room: Room): void {
        this.runOnAllList((list) => list.addNewRoom(room));
    }

    /**
     * Removes a room from all section skip lists.
     * Has no effect on sections that do not contain the room.
     *
     * @param room - The room to remove.
     */
    public removeRoom(room: Room): void {
        this.runOnAllList((list) => list.removeRoom(room));
    }

    /**
     * Re-inserts a room into its correct sorted position across all section skip
     * lists. Use this when a room's sort key has changed (e.g. a new message was
     * received) so that it is repositioned without a full rebuild.
     *
     * @param room - The room to re-insert.
     */
    public reInsertRoom(room: Room): void {
        this.runOnAllList((list) => list.reInsertRoom(room));
    }

    // TODO incorrect implementation
    // Rooms are not sorted across sections, but rather within each section.
    public getSortedRooms(): Room[] {
        return this.sortedTags.map((tag) => Array.from(this.roomSkipListByTag.get(tag) || [])).flat();
    }

    /**
     * Returns one {@link Section} per tag, each containing the rooms that belong
     * to that section and are part of the currently active space. Optionally
     * further restricts each section's rooms to those matching the given filter keys.
     *
     * @param filterKeys - An optional list of {@link FilterKey}s used to narrow
     *   the rooms returned within each section (e.g. only unread or mention rooms).
     * @returns An array of sections in display order: Favourites, All Chats, Low Priority.
     */
    public getSections(filterKeys?: FilterKey[]): Section[] {
        return this.sortedTags.map((tag) => {
            const filters = filterBoolean([this.filterByTag.get(tag)?.key, ...(filterKeys || [])]);

            return {
                tag,
                rooms: Array.from(this.roomSkipListByTag.get(tag)?.getRoomsInActiveSpace(filters) || []),
            };
        });
    }

    /**
     * Runs the provided callback on all the skip lists
     * @param cb The callback to run on all the skip lists
     */
    private runOnAllList(cb: (list: RoomSkipList) => void): void {
        this.sortedTags.forEach((tag) => {
            const skipList = this.roomSkipListByTag.get(tag);
            if (skipList) cb(skipList);
        });
    }
}
