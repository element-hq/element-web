/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";
import { getLastTs, sortRooms } from "../room-list/algorithms/tag-sorting/RecentAlgorithm";
import { MatrixClientPeg } from "../../MatrixClientPeg";

// See https://en.wikipedia.org/wiki/Skip_list

export class RecencySorter {
    public sort(rooms: Room[]): Room[] {
        return sortRooms(rooms);
    }

    public comparator(roomA: Room, roomB: Room): number {
        let myUserId = "";
        if (MatrixClientPeg.get()) {
            myUserId = MatrixClientPeg.get()!.getSafeUserId();
        }
        const roomALastTs = getLastTs(roomA, myUserId);
        const roomBLastTs = getLastTs(roomB, myUserId);

        return roomBLastTs - roomALastTs;
    }
}

export class RoomSkipList {
    private readonly sentinels: Sentinel[] = [];
    private readonly roomNodeMap: Map<string, RoomNode> = new Map();
    private sorter: RecencySorter = new RecencySorter();

    public create(rooms: Room[]): void {
        if (rooms.length === 0) {
            // No rooms, just create an empty level
            this.sentinels[0] = new Sentinel(0);
            return;
        }

        // 1. First sort the rooms and create a base sorted linked list
        const sortedRoomNodes = this.sorter.sort(rooms).map((room) => new RoomNode(room));
        let sentinel = new Sentinel(0);
        for (const node of sortedRoomNodes) {
            sentinel.setNext(node);
            this.roomNodeMap.set(node.room.roomId, node);
        }

        // 2. Create the rest of the sub linked lists
        do {
            this.sentinels[sentinel.level] = sentinel;
            sentinel = sentinel.generateNextLevel();
            // todo: set max level
        } while (sentinel.size > 1);
    }

    public removeRoom(room: Room): void {
        const existingNode = this.roomNodeMap.get(room.roomId);
        if (existingNode) {
            for (const sentinel of this.sentinels) {
                sentinel.removeNode(existingNode);
            }
        }
    }

    public addRoom(room: Room): void {
        // First, let's delete this room from the skip list
        this.removeRoom(room);
        const newNode = new RoomNode(room);

        // Start on the highest level, account for empty levels
        let sentinel = this.sentinels[0];
        for (let i = this.sentinels.length - 1; i >= 0; --i) {
            if (this.sentinels[i].size) {
                sentinel = this.sentinels[i];
                break;
            }
        }

        const current = sentinel.head;
        for (let i = sentinel.level; i >= 0; --i) {
            let nextNode = current?.next[i];
            while (this.sorter.comparator(room, nextNode.room) > 0) {}
        }
    }
}

export class Sentinel {
    private current?: RoomNode;
    public head?: RoomNode;
    public size: number = 0;

    public constructor(public readonly level: number) {}

    public setNext(node: RoomNode): void {
        if (!this.head) this.head = node;
        if (!this.current) {
            this.current = node;
        } else {
            node.previous[this.level] = this.current;
            this.current.next[this.level] = node;
            this.current = node;
        }
        this.size++;
    }

    public generateNextLevel(): Sentinel {
        const nextLevelSentinel = new Sentinel(this.level + 1);
        let current = this.head;
        while (current) {
            if (this.shouldPromote()) {
                nextLevelSentinel.setNext(current);
            }
            current = current.next[this.level];
        }
        return nextLevelSentinel;
    }

    public removeNode(node: RoomNode): void {
        // Let's first see if this node is even in this level
        const nodeInThisLevel = this.head === node || node.previous[this.level];
        if (!nodeInThisLevel) {
            // This node is not in this sentinel level, so nothing to do.
            return;
        }
        const prev = node.previous[this.level];
        if (prev) {
            prev.next[this.level] = node.next[this.level];
        } else {
            // This node was the head since it has no back links!
            // so update the head.
            this.head = node.next[this.level];
        }
        this.size--;
    }

    private shouldPromote(): boolean {
        return Math.random() < 0.5;
    }
}

export class RoomNode {
    public constructor(public readonly room: Room) {}

    public next: RoomNode[] = [];
    public previous: RoomNode[] = [];
}
