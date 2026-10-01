/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { RoomNode } from "./RoomNode";
import { shouldPromote } from "./utils";

/**
 * Represents one level of the skip list
 */
export class Level {
    public head?: RoomNode;
    private current?: RoomNode;
    private _size: number = 0;

    /**
     * The number of elements in this level
     */
    public get size(): number {
        return this._size;
    }

    public constructor(public readonly level: number) {}

    /**
     * Insert node after current
     */
    public setNext(node: RoomNode): void {
        if (!this.head) this.head = node;
        if (!this.current) {
            this.current = node;
        } else {
            node.previous[this.level] = this.current;
            this.current.next[this.level] = node;
            this.current = node;
        }
        this._size++;
    }

    /**
     * Iterate through the elements in this level and create
     * a new level above this level by probabilistically determining
     * whether a given element must be promoted to the new level.
     */
    public generateNextLevel(): Level {
        const nextLevelSentinel = new Level(this.level + 1);
        let current = this.head;
        while (current) {
            if (shouldPromote()) {
                nextLevelSentinel.setNext(current);
            }
            current = current.next[this.level];
        }
        return nextLevelSentinel;
    }

    /**
     * Removes a given node from this level.
     * Does nothing if the given node is not present in this level.
     */
    public removeNode(node: RoomNode): void {
        // Let's first see if this node is even in this level
        const nodeInThisLevel = this.head === node || node.previous[this.level];
        if (!nodeInThisLevel) {
            // This node is not in this sentinel level, so nothing to do.
            return;
        }
        const prev = node.previous[this.level];
        if (prev) {
            const nextNode = node.next[this.level];
            prev.next[this.level] = nextNode;
            if (nextNode) nextNode.previous[this.level] = prev;
        } else {
            // This node was the head since it has no back links!
            // so update the head.
            const next = node.next[this.level];
            this.head = next;
            if (next) next.previous[this.level] = node.previous[this.level];
        }
        this._size--;
    }

    /**
     * Put newNode after node in this level. No checks are done to ensure
     * that node is actually present in this level.
     */
    public insertAfter(node: RoomNode, newNode: RoomNode): void {
        const level = this.level;
        const nextNode = node.next[level];
        if (nextNode) {
            newNode.next[level] = nextNode;
            nextNode.previous[level] = newNode;
        }
        node.next[level] = newNode;
        newNode.previous[level] = node;
        this._size++;
    }

    /**
     *  Insert a given node at the head of this level.
     */
    public insertAtHead(newNode: RoomNode): void {
        const existingNode = this.head;
        this.head = newNode;
        if (existingNode) {
            newNode.next[this.level] = existingNode;
            existingNode.previous[this.level] = newNode;
        }
        this._size++;
    }
}
