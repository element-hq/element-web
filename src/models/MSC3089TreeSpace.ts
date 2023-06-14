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

import promiseRetry from "p-retry";

import { MatrixClient } from "../client";
import { EventType, IEncryptedFile, MsgType, UNSTABLE_MSC3089_BRANCH, UNSTABLE_MSC3089_LEAF } from "../@types/event";
import { Room } from "./room";
import { logger } from "../logger";
import { IContent, MatrixEvent } from "./event";
import {
    averageBetweenStrings,
    DEFAULT_ALPHABET,
    lexicographicCompare,
    nextString,
    prevString,
    simpleRetryOperation,
} from "../utils";
import { MSC3089Branch } from "./MSC3089Branch";
import { isRoomSharedHistory } from "../crypto/algorithms/megolm";
import { ISendEventResponse } from "../@types/requests";
import { FileType } from "../http-api";

/**
 * The recommended defaults for a tree space's power levels. Note that this
 * is UNSTABLE and subject to breaking changes without notice.
 */
export const DEFAULT_TREE_POWER_LEVELS_TEMPLATE = {
    // Owner
    invite: 100,
    kick: 100,
    ban: 100,

    // Editor
    redact: 50,
    state_default: 50,
    events_default: 50,

    // Viewer
    users_default: 0,

    // Mixed
    events: {
        [EventType.RoomPowerLevels]: 100,
        [EventType.RoomHistoryVisibility]: 100,
        [EventType.RoomTombstone]: 100,
        [EventType.RoomEncryption]: 100,
        [EventType.RoomName]: 50,
        [EventType.RoomMessage]: 50,
        [EventType.RoomMessageEncrypted]: 50,
        [EventType.Sticker]: 50,
    },

    users: {}, // defined by calling code
};

/**
 * Ease-of-use representation for power levels represented as simple roles.
 * Note that this is UNSTABLE and subject to breaking changes without notice.
 */
export enum TreePermissions {
    Viewer = "viewer", // Default
    Editor = "editor", // "Moderator" or ~PL50
    Owner = "owner", // "Admin" or PL100
}

/**
 * Represents a [MSC3089](https://github.com/matrix-org/matrix-doc/pull/3089)
 * file tree Space. Note that this is UNSTABLE and subject to breaking changes
 * without notice.
 */
export class MSC3089TreeSpace {
    public readonly room: Room;

    public constructor(private client: MatrixClient, public readonly roomId: string) {
        this.room = this.client.getRoom(this.roomId)!;

        if (!this.room) throw new Error("Unknown room");
    }

    /**
     * Syntactic sugar for room ID of the Space.
     */
    public get id(): string {
        return this.roomId;
    }

    /**
     * Whether or not this is a top level space.
     */
    public get isTopLevel(): boolean {
        // XXX: This is absolutely not how you find out if the space is top level
        // but is safe for a managed usecase like we offer in the SDK.
        const parentEvents = this.room.currentState.getStateEvents(EventType.SpaceParent);
        if (!parentEvents?.length) return true;
        return parentEvents.every((e) => !e.getContent()?.["via"]);
    }

    /**
     * Sets the name of the tree space.
     * @param name - The new name for the space.
     * @returns Promise which resolves when complete.
     */
    public async setName(name: string): Promise<void> {
        await this.client.sendStateEvent(this.roomId, EventType.RoomName, { name }, "");
    }

    /**
     * Invites a user to the tree space. They will be given the default Viewer
     * permission level unless specified elsewhere.
     * @param userId - The user ID to invite.
     * @param andSubspaces - True (default) to invite the user to all
     * directories/subspaces too, recursively.
     * @param shareHistoryKeys - True (default) to share encryption keys
     * with the invited user. This will allow them to decrypt the events (files)
     * in the tree. Keys will not be shared if the room is lacking appropriate
     * history visibility (by default, history visibility is "shared" in trees,
     * which is an appropriate visibility for these purposes).
     * @returns Promise which resolves when complete.
     */
    public async invite(userId: string, andSubspaces = true, shareHistoryKeys = true): Promise<void> {
        const promises: Promise<void>[] = [this.retryInvite(userId)];
        if (andSubspaces) {
            promises.push(...this.getDirectories().map((d) => d.invite(userId, andSubspaces, shareHistoryKeys)));
        }
        return Promise.all(promises).then(() => {
            // Note: key sharing is default on because for file trees it is relatively important that the invite
            // target can actually decrypt the files. The implied use case is that by inviting a user to the tree
            // it means the sender would like the receiver to view/download the files contained within, much like
            // sharing a folder in other circles.
            if (shareHistoryKeys && isRoomSharedHistory(this.room)) {
                // noinspection JSIgnoredPromiseFromCall - we aren't concerned as much if this fails.
                this.client.sendSharedHistoryKeys(this.roomId, [userId]);
            }
        });
    }

    private retryInvite(userId: string): Promise<void> {
        return simpleRetryOperation(async () => {
            await this.client.invite(this.roomId, userId).catch((e) => {
                // We don't want to retry permission errors forever...
                if (e?.errcode === "M_FORBIDDEN") {
                    throw new promiseRetry.AbortError(e);
                }
                throw e;
            });
        });
    }

    /**
     * Sets the permissions of a user to the given role. Note that if setting a user
     * to Owner then they will NOT be able to be demoted. If the user does not have
     * permission to change the power level of the target, an error will be thrown.
     * @param userId - The user ID to change the role of.
     * @param role - The role to assign.
     * @returns Promise which resolves when complete.
     */
    public async setPermissions(userId: string, role: TreePermissions): Promise<void> {
        const currentPls = this.room.currentState.getStateEvents(EventType.RoomPowerLevels, "");
        if (Array.isArray(currentPls)) throw new Error("Unexpected return type for power levels");

        const pls = currentPls?.getContent() || {};
        const viewLevel = pls["users_default"] || 0;
        const editLevel = pls["events_default"] || 50;
        const adminLevel = pls["events"]?.[EventType.RoomPowerLevels] || 100;

        const users = pls["users"] || {};
        switch (role) {
            case TreePermissions.Viewer:
                users[userId] = viewLevel;
                break;
            case TreePermissions.Editor:
                users[userId] = editLevel;
                break;
            case TreePermissions.Owner:
                users[userId] = adminLevel;
                break;
            default:
                throw new Error("Invalid role: " + role);
        }
        pls["users"] = users;

        await this.client.sendStateEvent(this.roomId, EventType.RoomPowerLevels, pls, "");
    }

    /**
     * Gets the current permissions of a user. Note that any users missing explicit permissions (or not
     * in the space) will be considered Viewers. Appropriate membership checks need to be performed
     * elsewhere.
     * @param userId - The user ID to check permissions of.
     * @returns The permissions for the user, defaulting to Viewer.
     */
    public getPermissions(userId: string): TreePermissions {
        const currentPls = this.room.currentState.getStateEvents(EventType.RoomPowerLevels, "");
        if (Array.isArray(currentPls)) throw new Error("Unexpected return type for power levels");

        const pls = currentPls?.getContent() || {};
        const viewLevel = pls["users_default"] || 0;
        const editLevel = pls["events_default"] || 50;
        const adminLevel = pls["events"]?.[EventType.RoomPowerLevels] || 100;

        const userLevel = pls["users"]?.[userId] || viewLevel;
        if (userLevel >= adminLevel) return TreePermissions.Owner;
        if (userLevel >= editLevel) return TreePermissions.Editor;
        return TreePermissions.Viewer;
    }

    /**
     * Creates a directory under this tree space, represented as another tree space.
     * @param name - The name for the directory.
     * @returns Promise which resolves to the created directory.
     */
    public async createDirectory(name: string): Promise<MSC3089TreeSpace> {
        const directory = await this.client.unstableCreateFileTree(name);

        await this.client.sendStateEvent(
            this.roomId,
            EventType.SpaceChild,
            {
                via: [this.client.getDomain()],
            },
            directory.roomId,
        );

        await this.client.sendStateEvent(
            directory.roomId,
            EventType.SpaceParent,
            {
                via: [this.client.getDomain()],
            },
            this.roomId,
        );

        return directory;
    }

    /**
     * Gets a list of all known immediate subdirectories to this tree space.
     * @returns The tree spaces (directories). May be empty, but not null.
     */
    public getDirectories(): MSC3089TreeSpace[] {
        const trees: MSC3089TreeSpace[] = [];
        const children = this.room.currentState.getStateEvents(EventType.SpaceChild);
        for (const child of children) {
            try {
                const stateKey = child.getStateKey();
                if (stateKey) {
                    const tree = this.client.unstableGetFileTreeSpace(stateKey);
                    if (tree) trees.push(tree);
                }
            } catch (e) {
                logger.warn("Unable to create tree space instance for listing. Are we joined?", e);
            }
        }
        return trees;
    }

    /**
     * Gets a subdirectory of a given ID under this tree space. Note that this will not recurse
     * into children and instead only look one level deep.
     * @param roomId - The room ID (directory ID) to find.
     * @returns The directory, or undefined if not found.
     */
    public getDirectory(roomId: string): MSC3089TreeSpace | undefined {
        return this.getDirectories().find((r) => r.roomId === roomId);
    }

    /**
     * Deletes the tree, kicking all members and deleting **all subdirectories**.
     * @returns Promise which resolves when complete.
     */
    public async delete(): Promise<void> {
        const subdirectories = this.getDirectories();
        for (const dir of subdirectories) {
            await dir.delete();
        }

        const kickMemberships = ["invite", "knock", "join"];
        const members = this.room.currentState.getStateEvents(EventType.RoomMember);
        for (const member of members) {
            const isNotUs = member.getStateKey() !== this.client.getUserId();
            if (isNotUs && kickMemberships.includes(member.getContent().membership!)) {
                const stateKey = member.getStateKey();
                if (!stateKey) {
                    throw new Error("State key not found for branch");
                }
                await this.client.kick(this.roomId, stateKey, "Room deleted");
            }
        }

        await this.client.leave(this.roomId);
    }

    private getOrderedChildren(children: MatrixEvent[]): { roomId: string; order: string }[] {
        const ordered: { roomId: string; order: string }[] = children
            .map((c) => ({ roomId: c.getStateKey(), order: c.getContent()["order"] }))
            .filter((c) => c.roomId) as { roomId: string; order: string }[];
        ordered.sort((a, b) => {
            if (a.order && !b.order) {
                return -1;
            } else if (!a.order && b.order) {
                return 1;
            } else if (!a.order && !b.order) {
                const roomA = this.client.getRoom(a.roomId);
                const roomB = this.client.getRoom(b.roomId);
                if (!roomA || !roomB) {
                    // just don't bother trying to do more partial sorting
                    return lexicographicCompare(a.roomId, b.roomId);
                }

                const createTsA = roomA.currentState.getStateEvents(EventType.RoomCreate, "")?.getTs() ?? 0;
                const createTsB = roomB.currentState.getStateEvents(EventType.RoomCreate, "")?.getTs() ?? 0;
                if (createTsA === createTsB) {
                    return lexicographicCompare(a.roomId, b.roomId);
                }
                return createTsA - createTsB;
            } else {
                // both not-null orders
                return lexicographicCompare(a.order, b.order);
            }
        });
        return ordered;
    }

    private getParentRoom(): Room {
        const parents = this.room.currentState.getStateEvents(EventType.SpaceParent);
        const parent = parents[0]; // XXX: Wild assumption
        if (!parent) throw new Error("Expected to have a parent in a non-top level space");

        // XXX: We are assuming the parent is a valid tree space.
        // We probably don't need to validate the parent room state for this usecase though.
        const stateKey = parent.getStateKey();
        if (!stateKey) throw new Error("No state key found for parent");
        const parentRoom = this.client.getRoom(stateKey);
        if (!parentRoom) throw new Error("Unable to locate room for parent");

        return parentRoom;
    }

    /**
     * Gets the current order index for this directory. Note that if this is the top level space
     * then -1 will be returned.
     * @returns The order index of this space.
     */
    public getOrder(): number {
        if (this.isTopLevel) return -1;

        const parentRoom = this.getParentRoom();
        const children = parentRoom.currentState.getStateEvents(EventType.SpaceChild);
        const ordered = this.getOrderedChildren(children);

        return ordered.findIndex((c) => c.roomId === this.roomId);
    }

    /**
     * Sets the order index for this directory within its parent. Note that if this is a top level
     * space then an error will be thrown. -1 can be used to move the child to the start, and numbers
     * larger than the number of children can be used to move the child to the end.
     * @param index - The new order index for this space.
     * @returns Promise which resolves when complete.
     * @throws Throws if this is a top level space.
     */
    public async setOrder(index: number): Promise<void> {
        if (this.isTopLevel) throw new Error("Cannot set order of top level spaces currently");

        const parentRoom = this.getParentRoom();
        const children = parentRoom.currentState.getStateEvents(EventType.SpaceChild);
        const ordered = this.getOrderedChildren(children);
        index = Math.max(Math.min(index, ordered.length - 1), 0);

        const currentIndex = this.getOrder();
        const movingUp = currentIndex < index;
        if (movingUp && index === ordered.length - 1) {
            index--;
        } else if (!movingUp && index === 0) {
            index++;
        }

        const prev = ordered[movingUp ? index : index - 1];
        const next = ordered[movingUp ? index + 1 : index];

        let newOrder = DEFAULT_ALPHABET[0];
        let ensureBeforeIsSane = false;
        if (!prev) {
            // Move to front
            if (next?.order) {
                newOrder = prevString(next.order);
            }
        } else if (index === ordered.length - 1) {
            // Move to back
            if (next?.order) {
                newOrder = nextString(next.order);
            }
        } else {
            // Move somewhere in the middle
            const startOrder = prev?.order;
            const endOrder = next?.order;
            if (startOrder && endOrder) {
                if (startOrder === endOrder) {
                    // Error case: just move +1 to break out of awful math
                    newOrder = nextString(startOrder);
                } else {
                    newOrder = averageBetweenStrings(startOrder, endOrder);
                }
            } else {
                if (startOrder) {
                    // We're at the end (endOrder is null, so no explicit order)
                    newOrder = nextString(startOrder);
                } else if (endOrder) {
                    // We're at the start (startOrder is null, so nothing before us)
                    newOrder = prevString(endOrder);
                } else {
                    // Both points are unknown. We're likely in a range where all the children
                    // don't have particular order values, so we may need to update them too.
                    // The other possibility is there's only us as a child, but we should have
                    // shown up in the other states.
                    ensureBeforeIsSane = true;
                }
            }
        }

        if (ensureBeforeIsSane) {
            // We were asked by the order algorithm to prepare the moving space for a landing
            // in the undefined order part of the order array, which means we need to update the
            // spaces that come before it with a stable order value.
            let lastOrder: string | undefined;
            for (let i = 0; i <= index; i++) {
                const target = ordered[i];
                if (i === 0) {
                    lastOrder = target.order;
                }
                if (!target.order) {
                    // XXX: We should be creating gaps to avoid conflicts
                    lastOrder = lastOrder ? nextString(lastOrder) : DEFAULT_ALPHABET[0];
                    const currentChild = parentRoom.currentState.getStateEvents(EventType.SpaceChild, target.roomId);
                    const content = currentChild?.getContent() ?? { via: [this.client.getDomain()] };
                    await this.client.sendStateEvent(
                        parentRoom.roomId,
                        EventType.SpaceChild,
                        {
                            ...content,
                            order: lastOrder,
                        },
                        target.roomId,
                    );
                } else {
                    lastOrder = target.order;
                }
            }
            if (lastOrder) {
                newOrder = nextString(lastOrder);
            }
        }

        // TODO: Deal with order conflicts by reordering

        // Now we can finally update our own order state
        const currentChild = parentRoom.currentState.getStateEvents(EventType.SpaceChild, this.roomId);
        const content = currentChild?.getContent() ?? { via: [this.client.getDomain()] };
        await this.client.sendStateEvent(
            parentRoom.roomId,
            EventType.SpaceChild,
            {
                ...content,

                // TODO: Safely constrain to 50 character limit required by spaces.
                order: newOrder,
            },
            this.roomId,
        );
    }

    /**
     * Creates (uploads) a new file to this tree. The file must have already been encrypted for the room.
     * The file contents are in a type that is compatible with MatrixClient.uploadContent().
     * @param name - The name of the file.
     * @param encryptedContents - The encrypted contents.
     * @param info - The encrypted file information.
     * @param additionalContent - Optional event content fields to include in the message.
     * @returns Promise which resolves to the file event's sent response.
     */
    public async createFile(
        name: string,
        encryptedContents: FileType,
        info: Partial<IEncryptedFile>,
        additionalContent?: IContent,
    ): Promise<ISendEventResponse> {
        const { content_uri: mxc } = await this.client.uploadContent(encryptedContents, {
            includeFilename: false,
        });
        info.url = mxc;

        const fileContent = {
            msgtype: MsgType.File,
            body: name,
            url: mxc,
            file: info,
        };

        additionalContent = additionalContent ?? {};
        if (additionalContent["m.new_content"]) {
            // We do the right thing according to the spec, but due to how relations are
            // handled we also end up duplicating this information to the regular `content`
            // as well.
            additionalContent["m.new_content"] = fileContent;
        }

        const res = await this.client.sendMessage(this.roomId, {
            ...additionalContent,
            ...fileContent,
            [UNSTABLE_MSC3089_LEAF.name]: {},
        });

        await this.client.sendStateEvent(
            this.roomId,
            UNSTABLE_MSC3089_BRANCH.name,
            {
                active: true,
                name: name,
            },
            res["event_id"],
        );

        return res;
    }

    /**
     * Retrieves a file from the tree.
     * @param fileEventId - The event ID of the file.
     * @returns The file, or null if not found.
     */
    public getFile(fileEventId: string): MSC3089Branch | null {
        const branch = this.room.currentState.getStateEvents(UNSTABLE_MSC3089_BRANCH.name, fileEventId);
        return branch ? new MSC3089Branch(this.client, branch, this) : null;
    }

    /**
     * Gets an array of all known files for the tree.
     * @returns The known files. May be empty, but not null.
     */
    public listFiles(): MSC3089Branch[] {
        return this.listAllFiles().filter((b) => b.isActive);
    }

    /**
     * Gets an array of all known files for the tree, including inactive/invalid ones.
     * @returns The known files. May be empty, but not null.
     */
    public listAllFiles(): MSC3089Branch[] {
        const branches = this.room.currentState.getStateEvents(UNSTABLE_MSC3089_BRANCH.name) ?? [];
        return branches.map((e) => new MSC3089Branch(this.client, e, this));
    }
}
