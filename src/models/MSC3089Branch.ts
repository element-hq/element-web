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

import { MatrixClient } from "../client";
import { IEncryptedFile, RelationType, UNSTABLE_MSC3089_BRANCH } from "../@types/event";
import { IContent, MatrixEvent } from "./event";
import { MSC3089TreeSpace } from "./MSC3089TreeSpace";
import { EventTimeline } from "./event-timeline";
import { FileType } from "../http-api";
import type { ISendEventResponse } from "../@types/requests";

/**
 * Represents a [MSC3089](https://github.com/matrix-org/matrix-doc/pull/3089) branch - a reference
 * to a file (leaf) in the tree. Note that this is UNSTABLE and subject to breaking changes
 * without notice.
 */
export class MSC3089Branch {
    public constructor(
        private client: MatrixClient,
        public readonly indexEvent: MatrixEvent,
        public readonly directory: MSC3089TreeSpace,
    ) {
        // Nothing to do
    }

    /**
     * The file ID.
     */
    public get id(): string {
        const stateKey = this.indexEvent.getStateKey();
        if (!stateKey) {
            throw new Error("State key not found for branch");
        }
        return stateKey;
    }

    /**
     * Whether this branch is active/valid.
     */
    public get isActive(): boolean {
        return this.indexEvent.getContent()["active"] === true;
    }

    /**
     * Version for the file, one-indexed.
     */
    public get version(): number {
        return this.indexEvent.getContent()["version"] ?? 1;
    }

    private get roomId(): string {
        return this.indexEvent.getRoomId()!;
    }

    /**
     * Deletes the file from the tree, including all prior edits/versions.
     * @returns Promise which resolves when complete.
     */
    public async delete(): Promise<void> {
        await this.client.sendStateEvent(this.roomId, UNSTABLE_MSC3089_BRANCH.name, {}, this.id);
        await this.client.redactEvent(this.roomId, this.id);

        const nextVersion = (await this.getVersionHistory())[1]; // [0] will be us
        if (nextVersion) await nextVersion.delete(); // implicit recursion
    }

    /**
     * Gets the name for this file.
     * @returns The name, or "Unnamed File" if unknown.
     */
    public getName(): string {
        return this.indexEvent.getContent()["name"] || "Unnamed File";
    }

    /**
     * Sets the name for this file.
     * @param name - The new name for this file.
     * @returns Promise which resolves when complete.
     */
    public async setName(name: string): Promise<void> {
        await this.client.sendStateEvent(
            this.roomId,
            UNSTABLE_MSC3089_BRANCH.name,
            {
                ...this.indexEvent.getContent(),
                name: name,
            },
            this.id,
        );
    }

    /**
     * Gets whether or not a file is locked.
     * @returns True if locked, false otherwise.
     */
    public isLocked(): boolean {
        return this.indexEvent.getContent()["locked"] || false;
    }

    /**
     * Sets a file as locked or unlocked.
     * @param locked - True to lock the file, false otherwise.
     * @returns Promise which resolves when complete.
     */
    public async setLocked(locked: boolean): Promise<void> {
        await this.client.sendStateEvent(
            this.roomId,
            UNSTABLE_MSC3089_BRANCH.name,
            {
                ...this.indexEvent.getContent(),
                locked: locked,
            },
            this.id,
        );
    }

    /**
     * Gets information about the file needed to download it.
     * @returns Information about the file.
     */
    public async getFileInfo(): Promise<{ info: IEncryptedFile; httpUrl: string }> {
        const event = await this.getFileEvent();

        const file = event.getOriginalContent()["file"];
        const httpUrl = this.client.mxcUrlToHttp(file["url"]);

        if (!httpUrl) {
            throw new Error(`No HTTP URL available for ${file["url"]}`);
        }

        return { info: file, httpUrl: httpUrl };
    }

    /**
     * Gets the event the file points to.
     * @returns Promise which resolves to the file's event.
     */
    public async getFileEvent(): Promise<MatrixEvent> {
        const room = this.client.getRoom(this.roomId);
        if (!room) throw new Error("Unknown room");

        let event: MatrixEvent | undefined = room.getUnfilteredTimelineSet().findEventById(this.id);

        // keep scrolling back if needed until we find the event or reach the start of the room:
        while (!event && room.getLiveTimeline().getState(EventTimeline.BACKWARDS)!.paginationToken) {
            await this.client.scrollback(room, 100);
            event = room.getUnfilteredTimelineSet().findEventById(this.id);
        }

        if (!event) throw new Error("Failed to find event");

        // Sometimes the event isn't decrypted for us, so do that. We specifically set `emit: true`
        // to ensure that the relations system in the sdk will function.
        await this.client.decryptEventIfNeeded(event, { emit: true, isRetry: true });

        return event;
    }

    /**
     * Creates a new version of this file with contents in a type that is compatible with MatrixClient.uploadContent().
     * @param name - The name of the file.
     * @param encryptedContents - The encrypted contents.
     * @param info - The encrypted file information.
     * @param additionalContent - Optional event content fields to include in the message.
     * @returns Promise which resolves to the file event's sent response.
     */
    public async createNewVersion(
        name: string,
        encryptedContents: FileType,
        info: Partial<IEncryptedFile>,
        additionalContent?: IContent,
    ): Promise<ISendEventResponse> {
        const fileEventResponse = await this.directory.createFile(name, encryptedContents, info, {
            ...(additionalContent ?? {}),
            "m.new_content": true,
            "m.relates_to": {
                rel_type: RelationType.Replace,
                event_id: this.id,
            },
        });

        // Update the version of the new event
        await this.client.sendStateEvent(
            this.roomId,
            UNSTABLE_MSC3089_BRANCH.name,
            {
                active: true,
                name: name,
                version: this.version + 1,
            },
            fileEventResponse["event_id"],
        );

        // Deprecate ourselves
        await this.client.sendStateEvent(
            this.roomId,
            UNSTABLE_MSC3089_BRANCH.name,
            {
                ...this.indexEvent.getContent(),
                active: false,
            },
            this.id,
        );

        return fileEventResponse;
    }

    /**
     * Gets the file's version history, starting at this file.
     * @returns Promise which resolves to the file's version history, with the
     * first element being the current version and the last element being the first version.
     */
    public async getVersionHistory(): Promise<MSC3089Branch[]> {
        const fileHistory: MSC3089Branch[] = [];
        fileHistory.push(this); // start with ourselves

        const room = this.client.getRoom(this.roomId);
        if (!room) throw new Error("Invalid or unknown room");

        // Clone the timeline to reverse it, getting most-recent-first ordering, hopefully
        // shortening the awful loop below. Without the clone, we can unintentionally mutate
        // the timeline.
        const timelineEvents = [...room.getLiveTimeline().getEvents()].reverse();

        // XXX: This is a very inefficient search, but it's the best we can do with the
        // relations structure we have in the SDK. As of writing, it is not worth the
        // investment in improving the structure.
        let childEvent: MatrixEvent | undefined;
        let parentEvent = await this.getFileEvent();
        do {
            childEvent = timelineEvents.find((e) => e.replacingEventId() === parentEvent.getId());
            if (childEvent) {
                const branch = this.directory.getFile(childEvent.getId()!);
                if (branch) {
                    fileHistory.push(branch);
                    parentEvent = childEvent;
                } else {
                    break; // prevent infinite loop
                }
            }
        } while (childEvent);

        return fileHistory;
    }
}
