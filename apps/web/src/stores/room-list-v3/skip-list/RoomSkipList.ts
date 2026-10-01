/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import type { Sorter, SortingAlgorithm } from "./sorters";
import type { AnyFilter, FilterKey } from "./filters";
import { RoomNode } from "./RoomNode";
import { shouldPromote } from "./utils";
import { Level } from "./Level";
import { SortedRoomIterator, SortedSpaceFilteredIterator } from "./iterators";

/**
 * Implements a skip list that stores rooms using a given sorting algorithm.
 * See See https://en.wikipedia.org/wiki/Skip_list
 */
export class RoomSkipList implements Iterable<Room> {
    private levels: Level[] = [new Level(0)];
    private roomNodeMap: Map<string, RoomNode> = new Map();
    public initialized: boolean = false;

    public constructor(
        private sorter: Sorter,
        private filters: AnyFilter[] = [],
    ) {}

    private reset(): void {
        this.levels = [new Level(0)];
        this.roomNodeMap = new Map();
    }

    /**
     * Seed the list with an initial list of rooms.
     */
    public seed(rooms: Room[]): void {
        // 1. First sort the rooms and create a base sorted linked list
        const sortedRoomNodes = this.sorter.sort(rooms).map((room) => new RoomNode(room));
        let currentLevel = this.levels[0];
        for (const node of sortedRoomNodes) {
            node.applyFilters(this.filters);
            currentLevel.setNext(node);
            this.roomNodeMap.set(node.room.roomId, node);
        }

        // 2. Create the rest of the sub linked lists
        do {
            this.levels[currentLevel.level] = currentLevel;
            currentLevel = currentLevel.generateNextLevel();
        } while (currentLevel.size > 1);

        // 3. Go through the list of rooms and mark nodes in active space
        this.calculateActiveSpaceForNodes();

        this.initialized = true;
    }

    /**
     * Go through all the room nodes and check if they belong to the active space.
     */
    public calculateActiveSpaceForNodes(): void {
        for (const node of this.roomNodeMap.values()) {
            node.checkIfRoomBelongsToActiveSpace();
        }
    }

    /**
     * Change the sorting algorithm used by the skip list.
     * This will reset the list and will rebuild from scratch.
     */
    public useNewSorter(sorter: Sorter, rooms: Room[]): void {
        this.reset();
        this.sorter = sorter;
        this.seed(rooms);
    }

    /**
     * Change the filters used by the skip list.
     * This will apply the new filters to all existing nodes.
     */
    public useNewFilters(filters: AnyFilter[]): void {
        this.filters = filters;
        for (const node of this.roomNodeMap.values()) {
            node.applyFilters(this.filters);
        }
    }

    /**
     * Removes a given room from the skip list.
     */
    public removeRoom(room: Room): void {
        const existingNode = this.roomNodeMap.get(room.roomId);
        this.roomNodeMap.delete(room.roomId);
        if (existingNode) {
            for (const level of this.levels) {
                level.removeNode(existingNode);
            }
        }
    }

    /**
     * Re-inserts a room that is already in the skiplist.
     * This method does nothing if the room isn't already in the skiplist.
     * @param room the room to add
     */
    public reInsertRoom(room: Room): void {
        if (!this.roomNodeMap.has(room.roomId)) {
            return;
        }
        this.removeRoom(room);
        this.addNewRoom(room);
    }

    /**
     * Adds a new room to the skiplist.
     * This method does nothing if the room is already in the skiplist.
     * @param room the room to add
     */
    public addNewRoom(room: Room): void {
        if (this.roomNodeMap.has(room.roomId)) {
            logger.error(`Can't add room to skiplist: ${room.roomId} is already in the skiplist!`);
            return;
        }
        this.insertRoom(room);
    }

    /**
     * Adds a given room to the correct sorted position in the list.
     */
    private insertRoom(room: Room): void {
        const newNode = new RoomNode(room);
        newNode.checkIfRoomBelongsToActiveSpace();
        newNode.applyFilters(this.filters);
        this.roomNodeMap.set(room.roomId, newNode);

        /**
         * This array tracks where the new node must be inserted in a
         * given level.
         * The index is the level and the value represents where the
         * insertion must happen.
         * If the value is null, it simply means that we need to insert
         * at the head.
         * If the value is a RoomNode, simply insert after this node.
         */
        const insertionNodes: (RoomNode | null)[] = [];

        /**
         * Now we'll do the actual work of finding where to insert this
         * node.
         *
         * We start at the top most level and move downwards ...
         *
         * Every node in a level is also present in the level below it, so
         * each level carries on from the predecessor found in the level
         * above instead of starting again at the head.
         */
        let predecessor: RoomNode | null = null;

        for (let j = this.levels.length - 1; j >= 0; --j) {
            const level = this.levels[j];

            /**
             * If the head is undefined, that means this level is empty.
             * So mark it as such in insertionNodes and skip over this
             * level.
             * predecessor is always null here, since a node in the level
             * above would also be in this one.
             */
            if (!level?.head) {
                insertionNodes[j] = null;
                continue;
            }

            /**
             * So there's actually some nodes in this level ...
             * All we need to do is find the node that is smaller or
             * equal to the node that we wish to insert.
             */
            let previous: RoomNode | null = predecessor;
            let current: RoomNode | undefined = predecessor ? predecessor.next[j] : level.head;
            while (current) {
                if (this.sorter.comparator(current.room, room) < 0) {
                    previous = current;
                    current = current.next[j];
                } else break;
            }

            /**
             * previous will now be null if there's no node in this level
             * smaller than the node we wish to insert or it will be a
             * RoomNode.
             * This is exactly what we need to track in insertionNodes!
             */
            insertionNodes[j] = previous;
            predecessor = previous;
        }

        /**
         * We're done with difficult part, now we just need to do the
         * actual node insertion.
         *
         * Whether our new node should be present in a level
         * is decided by coin toss.
         * We work the height out up front so that a level can be added
         * once the list outgrows the levels it was seeded with.
         */
        let height = 1;
        const maxLevels = this.maxLevels;
        while (height < maxLevels && shouldPromote()) ++height;

        for (let level = 0; level < height; ++level) {
            if (!this.levels[level]) this.levels[level] = new Level(level);
            /**
             * A level that didn't exist during the search has no
             * insertionNodes entry and is empty, so the new node becomes
             * its head.
             */
            const node = insertionNodes[level] ?? null;
            if (node) this.levels[level].insertAfter(node, newNode);
            else this.levels[level].insertAtHead(newNode);
        }
    }

    /**
     * The largest number of levels this list will use, kept in step with its size so the
     * search doesn't look at more and more nodes as rooms are added after the seed.
     */
    private get maxLevels(): number {
        return Math.max(1, Math.ceil(Math.log2(this.size + 1)));
    }

    public [Symbol.iterator](): SortedRoomIterator {
        return new SortedRoomIterator(this.levels[0].head!);
    }

    /**
     * Returns an iterator that can be used to generate a list of sorted rooms that belong
     * to the currently active space. Passing filterKeys will further filter the list such
     * that only rooms that match the filters are returned.
     *
     * @example To get an array of rooms:
     * Array.from(RLS.getRoomsInActiveSpace());
     *
     * @example Use a for ... of loop to iterate over rooms:
     * for(const room of RLS.getRoomsInActiveSpace()) { something(room); }
     *
     * @example Additional filtering:
     * Array.from(RLS.getRoomsInActiveSpace([FilterKeys.Favourite]));
     */
    public getRoomsInActiveSpace(filterKeys: FilterKey[] = []): SortedSpaceFilteredIterator {
        return new SortedSpaceFilteredIterator(this.levels[0].head!, filterKeys);
    }

    /**
     * The number of rooms currently in the skip list.
     */
    public get size(): number {
        return this.levels[0].size;
    }

    /**
     * The currently active sorting algorithm.
     */
    public get activeSortAlgorithm(): SortingAlgorithm {
        return this.sorter.type;
    }
}
