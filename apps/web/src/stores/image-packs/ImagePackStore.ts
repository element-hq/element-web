/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { mediaFromMxc } from "../../customisations/Media";

export const IMAGE_PACK_ROOM_EVENT_TYPE = "m.room.image_pack";
export const IMAGE_PACK_ROOM_EVENT_TYPE_UNSTABLE = "im.ponies.room.emotes";
export const IMAGE_PACK_ACCOUNT_EVENT_TYPE = "m.image_pack.rooms";
export const IMAGE_PACK_ACCOUNT_EVENT_TYPE_UNSTABLE = "im.ponies.user_emotes";

export interface ImagePackImage {
    url: string;
    info?: {
        mimetype?: string;
        w?: number;
        h?: number;
        size?: number;
    };
    body?: string;
}

export interface ImagePack {
    images: Record<string, ImagePackImage>;
    pack?: {
        display_name?: string;
        avatar_url?: string;
        usage?: string[];
        attribution?: string;
    };
}

export class ImagePackStore extends AsyncStoreWithClient<object> {
    private static internalInstance: ImagePackStore;

    public constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): ImagePackStore {
        if (!ImagePackStore.internalInstance) {
            ImagePackStore.internalInstance = new ImagePackStore();
        }
        return ImagePackStore.internalInstance;
    }

    public override get matrixClient(): MatrixClient | null {
        return this.readyStore.mxClient ?? MatrixClientPeg.get();
    }

    private preloadedUrls = new Set<string>();

    protected async onAction(payload: ActionPayload): Promise<void> {
        if (payload.action === "view_room" && (payload as any).room_id) {
            this.preloadRoomPacks((payload as any).room_id as string);
        }
    }

    public preloadRoomPacks(roomId: string): void {
        try {
            if (typeof window === "undefined") return;

            const roomPacks = this.getRoomImagePacks(roomId);
            const globalPacks = this.getGlobalImagePacks();
            const allPacks = [...globalPacks, ...roomPacks];

            const urlsToPreload: string[] = [];

            for (const p of allPacks) {
                if (!p.pack?.images) continue;

                // Preload tab icon / avatar
                const firstImage = Object.values(p.pack.images || {})[0];
                const avatarUrl = p.pack.pack?.avatar_url || firstImage?.url;
                if (avatarUrl) {
                    try {
                        const avatarThumb = mediaFromMxc(avatarUrl).getThumbnailOfSourceHttp(32, 32, "crop");
                        if (avatarThumb && !this.preloadedUrls.has(avatarThumb)) {
                            this.preloadedUrls.add(avatarThumb);
                            urlsToPreload.push(avatarThumb);
                        }
                    } catch {}
                }

                // Preload all sticker images in pack
                for (const img of Object.values(p.pack.images)) {
                    if (img?.url) {
                        try {
                            const http = mediaFromMxc(img.url).srcHttp;
                            if (http && !this.preloadedUrls.has(http)) {
                                this.preloadedUrls.add(http);
                                urlsToPreload.push(http);
                            }
                        } catch {}
                    }
                }
            }

            if (urlsToPreload.length === 0) return;

            // Preload smoothly in background in small batches
            let index = 0;
            const batchSize = 8;
            const loadNextBatch = (): void => {
                if (index >= urlsToPreload.length) return;
                const batch = urlsToPreload.slice(index, index + batchSize);
                index += batchSize;
                for (const url of batch) {
                    try {
                        const img = new window.Image();
                        img.decoding = "async";
                        img.src = url;
                    } catch {}
                }
                if (index < urlsToPreload.length) {
                    if (typeof window.requestIdleCallback === "function") {
                        window.requestIdleCallback(loadNextBatch);
                    } else {
                        setTimeout(loadNextBatch, 60);
                    }
                }
            };

            if (typeof window.requestIdleCallback === "function") {
                window.requestIdleCallback(loadNextBatch);
            } else {
                setTimeout(loadNextBatch, 30);
            }
        } catch (e) {
            console.warn("Failed to preload image packs", e);
        }
    }

    protected async onReady(): Promise<void> {}

    public getRoomImagePacks(roomId: string): { id: string; pack: ImagePack; roomId: string }[] {
        const client = this.matrixClient;
        if (!client) return [];

        const room = client.getRoom(roomId);
        if (!room) return [];

        // Collect current room and all nested ancestor and descendant spaces recursively
        const visited = new Set<string>([roomId]);
        const queue: string[] = [roomId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentRoom = client.getRoom(currentId);
            if (!currentRoom) continue;

            // 1. Upward: direct parents from m.space.parent
            const parentEvents = currentRoom.currentState.getStateEvents("m.space.parent") || [];
            const parents = Array.isArray(parentEvents) ? parentEvents : [parentEvents];
            for (const p of parents) {
                const parentId = p?.getStateKey();
                if (parentId && !visited.has(parentId)) {
                    visited.add(parentId);
                    queue.push(parentId);
                }
            }

            // 2. Upward: spaces that declare currentId as child via m.space.child
            for (const r of client.getRooms()) {
                if (r.isSpaceRoom() && !visited.has(r.roomId)) {
                    const childEvent = r.currentState.getStateEvents("m.space.child", currentId);
                    if (childEvent && childEvent.getContent()?.via) {
                        visited.add(r.roomId);
                        queue.push(r.roomId);
                    }
                }
            }

            // 3. Downward: if currentId is a space, traverse any nested sub-spaces
            if (currentRoom.isSpaceRoom()) {
                const childEvents = currentRoom.currentState.getStateEvents("m.space.child") || [];
                const children = Array.isArray(childEvents) ? childEvents : [childEvents];
                for (const c of children) {
                    const childId = c?.getStateKey();
                    if (childId && !visited.has(childId)) {
                        const childRoom = client.getRoom(childId);
                        if (childRoom && childRoom.isSpaceRoom()) {
                            visited.add(childId);
                            queue.push(childId);
                        }
                    }
                }
            }
        }

        const EVENT_TYPES = ["m.room.image_pack", "im.ponies.room_emotes", "im.ponies.room.emotes"];

        const seen = new Set<string>();
        const packs: { id: string; pack: ImagePack; roomId: string }[] = [];

        for (const rId of visited) {
            const r = client.getRoom(rId);
            if (!r) continue;

            for (const type of EVENT_TYPES) {
                const rawEvents = r.currentState.getStateEvents(type) || [];
                const events = Array.isArray(rawEvents) ? rawEvents : [rawEvents];
                for (const ev of events) {
                    if (!ev) continue;
                    const key = ev.getStateKey() || "default";
                    const content = ev.getContent<ImagePack>();
                    if (!content || typeof content !== "object") continue;

                    const hasImages = Boolean(
                        content.images && typeof content.images === "object" && Object.keys(content.images).length > 0,
                    );
                    const hasDisplayName = Boolean(content.pack?.display_name);

                    // A pack with neither images nor display_name is an empty or deleted state event
                    if (!hasImages && !hasDisplayName) {
                        continue;
                    }

                    const uniqueKey = `${rId}_${key}`;
                    if (!seen.has(uniqueKey)) {
                        seen.add(uniqueKey);
                        const resolvedPack: ImagePack = {
                            ...content,
                            pack: {
                                ...content.pack,
                                display_name: content.pack?.display_name || r.name || key,
                                avatar_url: content.pack?.avatar_url || r.getMxcAvatarUrl() || undefined,
                            },
                        };
                        packs.push({ id: key, pack: resolvedPack, roomId: rId });
                    }
                }
            }
        }

        return packs;
    }

    public getGlobalImagePacks(): { id: string; pack: ImagePack; roomId?: string }[] {
        const client = this.matrixClient;
        if (!client) return [];

        const ACCOUNT_TYPES = [
            "m.image_pack.rooms",
            "im.ponies.user_emotes",
            "im.ponies.user.emotes",
            "im.ponies.room_emotes",
        ];

        const ROOM_TYPES = ["m.room.image_pack", "im.ponies.room_emotes", "im.ponies.room.emotes"];

        const globalPacks: { id: string; pack: ImagePack; roomId?: string }[] = [];
        const seenPacks = new Set<string>();

        for (const type of ACCOUNT_TYPES) {
            const ev = client.getAccountData(type as any);
            if (!ev) continue;
            const content = ev.getContent<any>();
            if (!content) continue;

            // 1. Direct user emote pack (e.g. im.ponies.user_emotes containing images directly)
            if (content.images && Object.keys(content.images).length > 0) {
                const packId = content.pack?.display_name || type;
                if (!seenPacks.has(packId)) {
                    seenPacks.add(packId);
                    globalPacks.push({
                        id: packId,
                        pack: content as ImagePack,
                    });
                }
            }

            // 2. Account data mapping rooms to packs (e.g. rooms: { [roomId]: { [stateKey]: {} } })
            const roomsData = content.rooms || content;
            if (roomsData && typeof roomsData === "object") {
                for (const [roomId, states] of Object.entries(roomsData)) {
                    if (!roomId.startsWith("!") || typeof states !== "object") continue;
                    const room = client.getRoom(roomId);
                    if (!room) continue;

                    for (const stateKey of Object.keys(states!)) {
                        for (const roomType of ROOM_TYPES) {
                            const event = room.currentState.getStateEvents(roomType, stateKey);
                            if (event) {
                                const uniqueKey = `${roomId}_${stateKey}`;
                                if (!seenPacks.has(uniqueKey)) {
                                    seenPacks.add(uniqueKey);
                                    const content = event.getContent<ImagePack>();
                                    if (!content || typeof content !== "object") continue;
                                    const hasImages = Boolean(
                                        content.images &&
                                        typeof content.images === "object" &&
                                        Object.keys(content.images).length > 0,
                                    );
                                    const hasDisplayName = Boolean(content.pack?.display_name);
                                    if (!hasImages && !hasDisplayName) continue;

                                    globalPacks.push({
                                        roomId,
                                        id: stateKey,
                                        pack: {
                                            ...content,
                                            pack: {
                                                ...content.pack,
                                                display_name: content.pack?.display_name || room.name || stateKey,
                                                avatar_url:
                                                    content.pack?.avatar_url || room.getMxcAvatarUrl() || undefined,
                                            },
                                        },
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        return globalPacks;
    }

    public async createOrUpdateRoomPack(roomId: string, stateKey: string, packData: ImagePack): Promise<void> {
        const client = this.matrixClient;
        if (!client) return;

        await client.sendStateEvent(roomId, IMAGE_PACK_ROOM_EVENT_TYPE as any, packData, stateKey);
        try {
            await client.sendStateEvent(roomId, "im.ponies.room_emotes" as any, packData, stateKey);
        } catch {}
    }

    public async deleteRoomPack(roomId: string, stateKey: string): Promise<void> {
        const client = this.matrixClient;
        if (!client) return;

        const EVENT_TYPES = [IMAGE_PACK_ROOM_EVENT_TYPE, "im.ponies.room_emotes", "im.ponies.room.emotes"];

        for (const type of EVENT_TYPES) {
            try {
                await client.sendStateEvent(roomId, type as any, {}, stateKey);
            } catch (e) {
                console.warn(`Failed to send empty event for ${type}:${stateKey} in ${roomId}`, e);
            }
        }
    }
}
