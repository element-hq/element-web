/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    IMAGE_PACK_EVENT_TYPE,
    IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_IMAGE_PACK_EVENT_TYPE,
    LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY,
    ROOM_IMAGE_PACK_ORDER_EVENT_TYPE,
} from "./types.ts";
import type { ImagePackDefinition, ImagePackKind, ImagePackScope } from "./types.ts";
export {
    IMAGE_PACK_EVENT_TYPE,
    IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_IMAGE_PACK_EVENT_TYPE,
    LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    ROOM_IMAGE_PACK_ORDER_EVENT_TYPE,
};
export interface ResolverClient {
    getUserId(): string | null;
    getRoom(roomId: string): ResolverRoom | null;
    getAccountData(eventType: string): { getContent(): unknown } | null;
}

export interface ResolverRoom {
    roomId: string;
    name?: string;
    currentState: {
        getStateEvents(eventType: string, stateKey?: string): unknown;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ResolvedPackSummary {
    roomId: string;
    stateKey: string;
    scope: ImagePackScope;
    kind: ImagePackKind;
    eventId?: string;
    displayName: string;
    pack: ImagePackDefinition;
}

function readPackContent(
    content: Record<string, unknown>,
    fallbackDisplayName: string,
    roomName?: string,
): ImagePackDefinition {
    const images = isRecord(content.images) ? content.images : {};
    const packMeta = isRecord(content.pack) ? content.pack : {};
    const pack: ImagePackDefinition = {
        displayName:
            typeof packMeta.display_name === "string" && packMeta.display_name.trim()
                ? packMeta.display_name.trim()
                : (roomName ?? fallbackDisplayName),
        images: Object.fromEntries(
            Object.entries(images).flatMap(([shortcode, value]) => {
                if (!isRecord(value) || typeof value.url !== "string" || !value.url.startsWith("mxc://")) return [];
                const image: ImagePackDefinition["images"][string] = { shortcode, url: value.url };
                if (typeof value.body === "string") image.body = value.body;
                if (isRecord(value.info)) image.info = value.info;
                return [[shortcode, image] as const];
            }),
        ),
    };
    if (typeof packMeta.avatar_url === "string") pack.avatarUrl = packMeta.avatar_url;
    if (typeof packMeta.attribution === "string") pack.attribution = packMeta.attribution;
    if (Array.isArray(packMeta.usage)) {
        pack.usage = packMeta.usage.filter((value): value is string => typeof value === "string");
    }
    return pack;
}

function hasVisiblePackContent(content: Record<string, unknown>): boolean {
    if (isRecord(content.images)) {
        for (const image of Object.values(content.images)) {
            if (isRecord(image) && typeof image.url === "string" && image.url.startsWith("mxc://")) return true;
        }
    }
    const pack = content.pack;
    if (!isRecord(pack)) return false;
    return ["display_name", "avatar_url", "attribution"].some(
        (key) => typeof pack[key] === "string" && pack[key].length > 0,
    );
}

function readPackEvent(room: ResolverRoom, stateKey: string): ResolvedPackSummary | null {
    const stable = room.currentState.getStateEvents(IMAGE_PACK_EVENT_TYPE, stateKey) as
        | { getContent(): unknown; getId?: () => string; isRedacted?: () => boolean }
        | null
        | undefined;
    const legacy = room.currentState.getStateEvents(LEGACY_IMAGE_PACK_EVENT_TYPE, stateKey) as
        | { getContent(): unknown; getId?: () => string; isRedacted?: () => boolean }
        | null
        | undefined;
    const event = stable ?? legacy;
    if (!event || typeof event.getContent !== "function") return null;
    if (event.isRedacted?.()) return null;
    const content = event.getContent();
    if (!isRecord(content)) return null;
    if (!hasVisiblePackContent(content)) return null;
    const def = readPackContent(content, "", room.name);
    return {
        roomId: room.roomId,
        stateKey,
        scope: "room",
        kind: "room",
        eventId: event.getId?.(),
        displayName: def.displayName,
        pack: def,
    };
}

/**
 * Resolve the list of packs enabled for a user in a deterministic order that
 * matches the spec's recommended priority:
 *   1. user / global packs (from `m.image_pack.rooms` and the legacy keys),
 *   2. room packs (from `m.room.image_pack`),
 *   3. space packs (caller passes the resolved ancestors).
 */
export function resolveEnabledPacks(
    client: ResolverClient,
    room: ResolverRoom,
    spaceAncestors: ResolverRoom[] = [],
): ResolvedPackSummary[] {
    const out: ResolvedPackSummary[] = [];
    const seen = new Set<string>();

    // 1. User / global references
    for (const eventType of [IMAGE_PACK_ROOMS_EVENT_TYPE, LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE]) {
        const event = client.getAccountData(eventType);
        const content = event?.getContent();
        if (!isRecord(content) || !isRecord(content.rooms)) continue;
        for (const [globalRoomId, packs] of Object.entries(content.rooms)) {
            if (!isRecord(packs)) continue;
            for (const stateKey of Object.keys(packs)) {
                if (stateKey === LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) continue;
                const referenced = client.getRoom(globalRoomId);
                if (!referenced) continue;
                const summary = readPackEvent(referenced, stateKey);
                if (!summary) continue;
                const key = `${summary.roomId}\u0000${summary.stateKey}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ ...summary, scope: "user", kind: "global" });
            }
        }
    }

    // 1b. Personal account-data pack (legacy)
    const personal = client.getAccountData(LEGACY_USER_IMAGE_PACK_EVENT_TYPE);
    if (personal) {
        const content = personal.getContent();
        if (isRecord(content) && hasVisiblePackContent(content)) {
            const personalPack = readPackContent(content, "Personal");
            const summary: ResolvedPackSummary = {
                roomId: client.getUserId() ?? "",
                stateKey: LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
                scope: "user",
                kind: "personal",
                displayName: personalPack.displayName || "Personal",
                pack: personalPack,
            };
            if (!seen.has(summary.stateKey)) {
                seen.add(summary.stateKey);
                out.push(summary);
            }
        }
    }

    // 2. Room packs (stable then legacy), sorted by the order marker if set.
    const roomPacks: ResolvedPackSummary[] = [];
    for (const eventType of [IMAGE_PACK_EVENT_TYPE, LEGACY_IMAGE_PACK_EVENT_TYPE]) {
        const events = room.currentState.getStateEvents(eventType);
        if (!Array.isArray(events)) continue;
        for (const event of events) {
            const candidate = event as { getStateKey?: () => string; getContent: () => unknown };
            const stateKey = candidate.getStateKey?.() ?? "";
            if (stateKey === LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) continue;
            const summary = readPackEvent(room, stateKey);
            if (!summary) continue;
            const key = `${summary.roomId}\u0000${summary.stateKey}`;
            if (seen.has(key)) continue;
            seen.add(key);
            roomPacks.push({ ...summary, scope: "room" });
        }
    }
    const orderEvent = client.getAccountData(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE);
    const orderContent = orderEvent?.getContent();
    if (isRecord(orderContent) && isRecord(orderContent.rooms)) {
        const stateKeys = orderContent.rooms[room.roomId];
        if (Array.isArray(stateKeys)) {
            const rank = new Map<string, number>();
            stateKeys.forEach((key, index) => {
                if (typeof key === "string") rank.set(key, index);
            });
            roomPacks.sort((a, b) => {
                const ra = rank.get(a.stateKey);
                const rb = rank.get(b.stateKey);
                if (ra === undefined && rb === undefined) return 0;
                if (ra === undefined) return 1;
                if (rb === undefined) return -1;
                return ra - rb;
            });
        }
    }
    for (const summary of roomPacks) {
        out.push(summary);
    }

    // 3. Space ancestor packs (caller passes the resolved ancestors).
    for (const ancestor of spaceAncestors) {
        for (const eventType of [IMAGE_PACK_EVENT_TYPE, LEGACY_IMAGE_PACK_EVENT_TYPE]) {
            const events = ancestor.currentState.getStateEvents(eventType);
            if (!Array.isArray(events)) continue;
            for (const event of events) {
                const candidate = event as { getStateKey?: () => string };
                const stateKey = candidate.getStateKey?.() ?? "";
                if (stateKey === LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) continue;
                const summary = readPackEvent(ancestor, stateKey);
                if (!summary) continue;
                const key = `${summary.roomId}\u0000${summary.stateKey}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ ...summary, scope: "space", kind: "space" });
            }
        }
    }

    return out;
}
