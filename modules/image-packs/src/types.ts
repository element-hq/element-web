/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Public type surface for the image-packs module. Kept dependency-free so it
 * can be imported by tests, the React UI, and the standalone Node side (e.g.
 * pack import/export) without pulling in the host app.
 */

/** Private account-data keys used for image-pack discovery sources. */
export const IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE = "org.element.image_pack_servers";
export const IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE = "org.element.image_pack_servers.unstable";
/** The old implementation used these keys while incorrectly claiming MSC2654 support. */
export const LEGACY_MSC2654_DISCOVERY_SOURCES_EVENT_TYPE = "im.ponies.image_pack_servers";
export const LEGACY_MSC2654_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE = "org.matrix.msc2654.image_pack_servers";

/**
 * Protocol event names and private compatibility keys. The module keeps its
 * own copies because the host app's `custom-emotes.ts` is not reachable from
 * a built module package — both are kept in sync intentionally.
 */
export const IMAGE_PACK_EVENT_TYPE = "m.room.image_pack";
export const LEGACY_IMAGE_PACK_EVENT_TYPE = "im.ponies.room_emotes";
export const IMAGE_PACK_ROOMS_EVENT_TYPE = "m.image_pack.rooms";
export const LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE = "im.ponies.emote_rooms";
export const LEGACY_USER_IMAGE_PACK_EVENT_TYPE = "im.ponies.user_emotes";
/** Private account-data key for per-room ordering; never written as a state event. */
export const ROOM_IMAGE_PACK_ORDER_EVENT_TYPE = "org.element.image_pack_order";
/** Legacy state key that older builds used for an invalid ordering event. */
export const LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY = "_order";

export type ImagePackScope = "user" | "room" | "space";
export type ImagePackKind = "personal" | "global" | "room" | "space";

export interface EmoteDefinition {
    shortcode: string;
    url: string;
    body?: string;
    info?: Record<string, unknown>;
}

export interface ImagePackDefinition {
    /** Human-readable name for the pack. */
    displayName: string;
    /** Optional avatar (MXC URI). */
    avatarUrl?: string;
    /** Optional attribution. */
    attribution?: string;
    /** Usage tags. Missing or empty means the pack supports every usage. */
    usage?: string[];
    /** Image map keyed by shortcode. */
    images: Record<string, EmoteDefinition>;
}

export interface DiscoverySource {
    id: string;
    /** URL of the discovery `index.json`. */
    url: string;
    /** Human-readable display name. Optional; derived from the URL if absent. */
    displayName?: string;
}

export interface DiscoveryIndexEntry {
    /** Pack identifier. Used as the `state_key` when installing the pack. */
    id: string;
    /** URL of the individual pack JSON file. */
    url: string;
    /** Optional display name declared by the index. */
    displayName?: string;
    /** Optional avatar URL declared by the index. */
    avatarUrl?: string;
    /** Optional attribution declared by the index. */
    attribution?: string;
}

export interface DiscoveryIndex {
    /** URL the index was fetched from. */
    sourceUrl: string;
    /** Pack entries. */
    packs: DiscoveryIndexEntry[];
}

export interface PackImportPayload {
    /** MSC2545 image map. */
    images: Record<string, Omit<EmoteDefinition, "shortcode">>;
    /** Optional MSC2545 metadata; packs may omit it entirely. */
    pack?: {
        display_name?: string;
        avatar_url?: string;
        attribution?: string;
        usage?: string[];
    };
}

export interface ImagePackView {
    roomId: string;
    stateKey: string;
    scope: ImagePackScope;
    kind: ImagePackKind;
    eventId?: string;
    displayName: string;
    pack: ImagePackDefinition;
}

export const PACK_IMPORT_SCHEMA_VERSION = 1 as const;

export const SHORTCODE_REGEX = /^[A-Za-z0-9_-]{1,100}$/;
export const MXC_REGEX = /^mxc:\/\/[^\s/]+\/[^\s]+$/;
