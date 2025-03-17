/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import type { Sorter, SortingAlgorithm } from "./sorters";
import type { Filter, FilterKey } from "./filters";
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
        private filters: Filter[] = [],
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
     * Adds a given room to the correct sorted position in the list.
     * If the room is already present in the list, it is first removed.
     */
    public addRoom(room: Room): void {
        /**
         * Remove this room from the skip list if necessary.
         */
        this.removeRoom(room);

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
         */
        for (let j = this.levels.length - 1; j >= 0; --j) {
            const level = this.levels[j];

            /**
             * If the head is undefined, that means this level is empty.
             * So mark it as such in insertionNodes and skip over this
             * level.
             */
            if (!level.head) {
                insertionNodes[j] = null;
                continue;
            }

            /**
             * So there's actually some nodes in this level ...
             * All we need to do is find the node that is smaller or
             * equal to the node that we wish to insert.
             */
            let current = level.head;
            let previous: RoomNode | null = null;
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
        }

        /**
         * We're done with difficult part, now we just need to do the
         * actual node insertion.
         */
        for (const [level, node] of insertionNodes.entries()) {
            /**
             * Whether our new node should be present in a level
             * is decided by coin toss.
             */
            if (level === 0 || shouldPromote()) {
                const levelObj = this.levels[level];
                if (node) levelObj.insertAfter(node, newNode);
                else levelObj.insertAtHead(newNode);
            } else {
                break;
            }
        }
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
