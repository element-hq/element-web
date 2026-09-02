/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import escapeHtml from "escape-html";
import {
    ClientEvent,
    KnownMembership,
    RoomStateEvent,
    type MatrixClient,
    type MatrixEvent,
    type Room,
    type RoomState,
} from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent, type RoomMessageTextEventContent } from "matrix-js-sdk/src/types";

import type {
    AccountDataTransaction,
    AccountDataTransactionCallback,
    ImagePackDefinition,
    PackWriters,
} from "@element-hq/element-web-module-image-packs";

import { SDKContextClass } from "./contexts/SDKContextClass";
export const IMAGE_PACK_EVENT_TYPE = "m.room.image_pack";
export const LEGACY_IMAGE_PACK_EVENT_TYPE = "im.ponies.room_emotes";
export const IMAGE_PACK_ROOMS_EVENT_TYPE = "m.image_pack.rooms";
export const LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE = "im.ponies.emote_rooms";
export const LEGACY_USER_IMAGE_PACK_EVENT_TYPE = "im.ponies.user_emotes";
export const ROOM_IMAGE_PACK_ORDER_EVENT_TYPE = "org.element.image_pack_order";
export const LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY = "_order";

const MAX_CANONICAL_SPACE_DEPTH = 20;
export const SHORTCODE_PATTERN = "[A-Za-z0-9_-]{1,100}";
export const SHORTCODE_REGEX = new RegExp(`^${SHORTCODE_PATTERN}$`);
const CUSTOM_EMOTE_TOKEN = new RegExp(`:(${SHORTCODE_PATTERN})(?:/(${SHORTCODE_PATTERN}))?:`, "g");

interface AccountDataTransactionState {
    tail: Promise<void>;
}

const accountDataTransactions = new WeakMap<MatrixClient, AccountDataTransactionState>();

const IMAGE_PACK_ACCOUNT_DATA_EVENT_TYPES = new Set([
    IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    ROOM_IMAGE_PACK_ORDER_EVENT_TYPE,
    "org.element.image_pack_servers",
    "org.element.image_pack_servers.unstable",
    "im.ponies.image_pack_servers",
    "org.matrix.msc2654.image_pack_servers",
]);
const IMAGE_PACK_ROOM_STATE_EVENT_TYPES = new Set([IMAGE_PACK_EVENT_TYPE, LEGACY_IMAGE_PACK_EVENT_TYPE]);

/** Subscribe settings surfaces to Matrix cache updates that can change image packs. */
export function subscribeToImagePackChanges(client: MatrixClient, listener: () => void, roomId?: string): () => void {
    const onAccountData = (event: MatrixEvent): void => {
        if (IMAGE_PACK_ACCOUNT_DATA_EVENT_TYPES.has(event.getType())) listener();
    };
    const onRoomState = (event: MatrixEvent, state: RoomState): void => {
        if (
            (roomId === undefined || state.roomId === roomId) &&
            IMAGE_PACK_ROOM_STATE_EVENT_TYPES.has(event.getType())
        ) {
            listener();
        }
    };

    client.on(ClientEvent.AccountData, onAccountData);
    client.on(RoomStateEvent.Events, onRoomState);

    return () => {
        client.removeListener(ClientEvent.AccountData, onAccountData);
        client.removeListener(RoomStateEvent.Events, onRoomState);
    };
}

/** Serialize read-modify-write account-data operations for one Matrix client. */
export async function runAccountDataTransaction<T>(
    client: MatrixClient,
    update: AccountDataTransactionCallback<T>,
): Promise<T> {
    const state =
        accountDataTransactions.get(client) ??
        (() => {
            const initial: AccountDataTransactionState = { tail: Promise.resolve() };
            accountDataTransactions.set(client, initial);
            return initial;
        })();
    const previous = state.tail;
    const operation = previous
        .catch(() => undefined)
        .then(async () => {
            const values = new Map<string, unknown>();
            const written = new Set<string>();
            const getLatest = async (eventType: string): Promise<unknown> => {
                if (written.has(eventType)) return values.get(eventType);
                const getFromServer = (
                    client as MatrixClient & {
                        getAccountDataFromServer?: (type: string) => Promise<unknown | null>;
                    }
                ).getAccountDataFromServer;
                if (typeof getFromServer === "function") {
                    try {
                        const current = await getFromServer.call(client, eventType);
                        if (current !== undefined) {
                            values.set(eventType, current ?? undefined);
                            return values.get(eventType);
                        }
                    } catch {
                        // Keep the synchronized local value if a refresh fails so the write can still proceed.
                    }
                }
                const current = client.getAccountData(eventType as never)?.getContent();
                return current;
            };
            const transaction: AccountDataTransaction = {
                get: (eventType) =>
                    written.has(eventType)
                        ? values.get(eventType)
                        : client.getAccountData(eventType as never)?.getContent(),
                getLatest,
                set: async (eventType, content) => {
                    const next = typeof content === "function" ? await content(await getLatest(eventType)) : content;
                    if (next === undefined) return {};
                    values.set(eventType, next);
                    written.add(eventType);
                    return client.setAccountData(eventType as never, next as never);
                },
            };
            return update(transaction);
        });
    state.tail = operation.then(
        () => undefined,
        () => undefined,
    );
    return operation;
}

export interface ImagePackImage {
    url: string;
    body?: string;
    info?: Record<string, unknown>;
}

export interface ImagePackContent {
    images: Record<string, ImagePackImage>;
    pack?: {
        display_name?: string;
        avatar_url?: string;
        usage?: string[];
        attribution?: string;
    };
}

interface ImagePackRoomsContent {
    rooms?: Record<string, Record<string, object>>;
}

export type ImagePackSource = "user" | "global" | "room" | "space";

export interface ResolvedImagePack {
    roomId: string;
    stateKey: string;
    displayName: string;
    source: ImagePackSource;
    content: ImagePackContent;
}

export interface CustomEmote {
    shortcode: string;
    url: string;
    body?: string;
    pack: ResolvedImagePack;
    packSlug: string;
    sendToken: string;
}

export interface DecoratedCustomEmoteContent {
    body: string;
    formattedBody?: string;
    hasCustomEmotes: boolean;
}

export interface EditableCustomEmoteContent {
    html: string;
    emotes: CustomEmote[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseImagePackContent(value: unknown): ImagePackContent | null {
    if (!isRecord(value) || !isRecord(value.images)) return null;

    const images: Record<string, ImagePackImage> = {};
    for (const [shortcode, image] of Object.entries(value.images)) {
        if (!isRecord(image) || typeof image.url !== "string" || !image.url.startsWith("mxc://")) continue;
        images[shortcode] = {
            url: image.url,
            body: typeof image.body === "string" ? image.body : undefined,
            info: isRecord(image.info) ? image.info : undefined,
        };
    }

    const pack = isRecord(value.pack)
        ? {
              display_name: typeof value.pack.display_name === "string" ? value.pack.display_name : undefined,
              avatar_url: typeof value.pack.avatar_url === "string" ? value.pack.avatar_url : undefined,
              usage: Array.isArray(value.pack.usage)
                  ? value.pack.usage.filter((usage): usage is string => typeof usage === "string")
                  : undefined,
              attribution: typeof value.pack.attribution === "string" ? value.pack.attribution : undefined,
          }
        : undefined;

    return { images, pack };
}

function hasVisiblePackContent(value: unknown): boolean {
    if (!isRecord(value)) return false;
    if (isRecord(value.images)) {
        for (const image of Object.values(value.images)) {
            if (isRecord(image) && typeof image.url === "string" && image.url.startsWith("mxc://")) return true;
        }
    }
    const pack = value.pack;
    if (!isRecord(pack)) return false;
    return ["display_name", "avatar_url", "attribution"].some(
        (key) => typeof pack[key] === "string" && pack[key].length > 0,
    );
}

function isEmoticonPack(content: ImagePackContent): boolean {
    const usage = content.pack?.usage;
    return !Array.isArray(usage) || usage.length === 0 || usage.includes("emoticon");
}

function getPackEvents(room: Room): MatrixEvent[] {
    const events = new Map<string, MatrixEvent>();

    for (const event of room.currentState.getStateEvents(LEGACY_IMAGE_PACK_EVENT_TYPE)) {
        if (event.getStateKey() !== LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) {
            events.set(event.getStateKey() ?? "", event);
        }
    }
    for (const event of room.currentState.getStateEvents(IMAGE_PACK_EVENT_TYPE)) {
        if (event.getStateKey() !== LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) {
            events.set(event.getStateKey() ?? "", event);
        }
    }

    return [...events.values()].sort((a, b) => (a.getStateKey() ?? "").localeCompare(b.getStateKey() ?? ""));
}

function getPackEvent(room: Room, stateKey: string): MatrixEvent | null {
    return (
        room.currentState.getStateEvents(IMAGE_PACK_EVENT_TYPE, stateKey) ??
        room.currentState.getStateEvents(LEGACY_IMAGE_PACK_EVENT_TYPE, stateKey) ??
        null
    );
}

function packFromEvent(room: Room, event: MatrixEvent, source: ImagePackSource): ResolvedImagePack | null {
    if (event.isRedacted()) return null;
    if (!hasVisiblePackContent(event.getContent())) return null;
    const content = parseImagePackContent(event.getContent());
    if (!content || !isEmoticonPack(content)) return null;

    const displayName = content.pack?.display_name?.trim() || room.name || event.getStateKey() || "Image pack";
    return {
        roomId: room.roomId,
        stateKey: event.getStateKey() ?? "",
        displayName,
        source,
        content,
    };
}

function getLegacyUserImagePack(client: MatrixClient): ResolvedImagePack | null {
    const event = client.getAccountData(LEGACY_USER_IMAGE_PACK_EVENT_TYPE as never);
    const content = parseImagePackContent(event?.getContent());
    const hasMetadata =
        content?.pack !== undefined &&
        [content.pack.display_name, content.pack.avatar_url, content.pack.attribution].some(
            (value) => typeof value === "string" && value.length > 0,
        );
    if (!content || (Object.keys(content.images).length === 0 && !hasMetadata) || !isEmoticonPack(content)) return null;

    return {
        roomId: client.getUserId() ?? "",
        stateKey: LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
        displayName: content.pack?.display_name?.trim() || "Personal emotes",
        source: "user",
        content,
    };
}

function getGlobalPackReferences(client: MatrixClient): Array<[roomId: string, stateKey: string]> {
    const references = new Set<string>();
    const result: Array<[string, string]> = [];

    for (const eventType of [IMAGE_PACK_ROOMS_EVENT_TYPE, LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE]) {
        const event = client.getAccountData(eventType as never);
        const content = event?.getContent<ImagePackRoomsContent>();
        if (!isRecord(content?.rooms)) continue;

        for (const [roomId, packs] of Object.entries(content.rooms)) {
            if (!isRecord(packs)) continue;
            for (const stateKey of Object.keys(packs)) {
                if (stateKey === LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) continue;
                const key = `${roomId}\u0000${stateKey}`;
                if (references.has(key)) continue;
                references.add(key);
                result.push([roomId, stateKey]);
            }
        }
    }

    return result.sort(([roomA, stateA], [roomB, stateB]) =>
        roomA === roomB ? stateA.localeCompare(stateB) : roomA.localeCompare(roomB),
    );
}

function addPack(packs: ResolvedImagePack[], seen: Set<string>, pack: ResolvedImagePack | null): void {
    if (!pack) return;
    const key = `${pack.roomId}\u0000${pack.stateKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    packs.push(pack);
}

export function getImagePacksForRoom(
    client: MatrixClient,
    room: Room,
    // Pack inheritance from parent spaces is best-effort: never start the space
    // store just to resolve it, since this runs while rendering the composer.
    getCanonicalParent = (roomId: string): Room | null =>
        SDKContextClass.instance.spaceStoreIfInitialised?.getCanonicalParent(roomId) ?? null,
): ResolvedImagePack[] {
    const packs: ResolvedImagePack[] = [];
    const seen = new Set<string>();

    addPack(packs, seen, getLegacyUserImagePack(client));

    for (const [roomId, stateKey] of getGlobalPackReferences(client)) {
        const packRoom = client.getRoom(roomId);
        if (!packRoom || packRoom.getMyMembership() !== KnownMembership.Join) continue;
        const event = getPackEvent(packRoom, stateKey);
        if (event) addPack(packs, seen, packFromEvent(packRoom, event, "global"));
    }

    for (const event of getPackEvents(room)) {
        addPack(packs, seen, packFromEvent(room, event, "room"));
    }

    const visited = new Set([room.roomId]);
    let child = room;
    for (let depth = 0; depth < MAX_CANONICAL_SPACE_DEPTH; depth++) {
        const parent = getCanonicalParent(child.roomId);
        if (!parent || parent.getMyMembership() !== KnownMembership.Join || visited.has(parent.roomId)) break;
        visited.add(parent.roomId);
        for (const event of getPackEvents(parent)) {
            addPack(packs, seen, packFromEvent(parent, event, "space"));
        }
        child = parent;
    }

    return packs;
}

function slugifyPackName(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 100) || "pack"
    );
}

export function getCustomEmotesForRoom(
    client: MatrixClient,
    room: Room,
    getCanonicalParent?: (roomId: string) => Room | null,
): CustomEmote[] {
    const emotes = getImagePacksForRoom(client, room, getCanonicalParent).flatMap((pack) =>
        Object.entries(pack.content.images).map(([shortcode, image]) => ({
            shortcode,
            url: image.url,
            body: typeof image.body === "string" ? image.body : undefined,
            pack,
            packSlug: slugifyPackName(pack.displayName),
            sendToken: `:${shortcode}:`,
        })),
    );

    const byShortcode = new Map<string, CustomEmote[]>();
    for (const emote of emotes) {
        const matches = byShortcode.get(emote.shortcode) ?? [];
        matches.push(emote);
        byShortcode.set(emote.shortcode, matches);
    }
    for (const matches of byShortcode.values()) {
        if (matches.length < 2) continue;

        const usedSlugs = new Set<string>();
        for (const emote of matches) {
            const baseSlug = emote.packSlug;
            let slug = baseSlug;
            let suffix = 2;
            while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`.slice(0, 100);
            usedSlugs.add(slug);
            emote.packSlug = slug;
            emote.sendToken = `:${emote.shortcode}/${slug}:`;
        }
    }

    return emotes;
}

export function resolveCustomEmoteToken(token: string, emotes: CustomEmote[]): CustomEmote | null {
    const match = /^:([A-Za-z0-9_-]{1,100})(?:\/([A-Za-z0-9_-]{1,100}))?:$/.exec(token);
    if (!match) return null;

    const [, shortcode, packSlug] = match;
    const matches = emotes.filter(
        (emote) => emote.shortcode === shortcode && (!packSlug || emote.packSlug === packSlug),
    );
    return matches.length === 1 ? matches[0] : null;
}

function isTokenInUrl(value: string, offset: number): boolean {
    const precedingText = value.slice(0, offset);
    const currentWord = /\S*$/.exec(precedingText)?.[0] ?? "";
    return /^(?:https?|ftp|matrix|mailto|tel):/i.test(currentWord);
}

function replaceTextNode(node: Text, emotes: CustomEmote[]): number {
    const value = node.nodeValue ?? "";
    CUSTOM_EMOTE_TOKEN.lastIndex = 0;

    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let replacementCount = 0;
    const document = node.ownerDocument;
    const fragment = document.createDocumentFragment();
    while ((match = CUSTOM_EMOTE_TOKEN.exec(value))) {
        if (isTokenInUrl(value, match.index)) continue;

        const emote = resolveCustomEmoteToken(match[0], emotes);
        if (!emote) continue;

        fragment.append(document.createTextNode(value.slice(lastIndex, match.index)));
        const image = document.createElement("img");
        image.setAttribute("data-mx-emoticon", "");
        image.setAttribute("src", emote.url);
        image.setAttribute("alt", emote.body || emote.shortcode);
        image.setAttribute("title", emote.shortcode);
        image.setAttribute("height", "32");
        fragment.append(image);
        lastIndex = match.index + match[0].length;
        replacementCount++;
    }

    if (replacementCount === 0) return 0;
    fragment.append(document.createTextNode(value.slice(lastIndex)));
    node.replaceWith(fragment);
    return replacementCount;
}

function replaceTokensInHtml(html: string, emotes: CustomEmote[]): { html: string; count: number } {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const walker = parsed.createTreeWalker(parsed.body, 4);
    const nodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) {
        const parent = current.parentElement;
        if (parent?.closest("a, code, pre, script, style")) continue;
        nodes.push(current as Text);
    }

    const count = nodes.reduce((total, node) => total + replaceTextNode(node, emotes), 0);
    return { html: parsed.body.innerHTML, count };
}

function normalizeQualifiedTokens(body: string, emotes: CustomEmote[]): string {
    CUSTOM_EMOTE_TOKEN.lastIndex = 0;
    return body.replace(CUSTOM_EMOTE_TOKEN, (token, _shortcode, _packSlug, offset: number) => {
        if (isTokenInUrl(body, offset)) return token;
        const emote = resolveCustomEmoteToken(token, emotes);
        return emote ? `:${emote.shortcode}:` : token;
    });
}

export function decorateCustomEmotes(
    body: string,
    formattedBody: string | undefined,
    emotes: CustomEmote[],
): DecoratedCustomEmoteContent {
    const sourceHtml = formattedBody ?? escapeHtml(body).replace(/\n/g, "<br>");
    const replacement = replaceTokensInHtml(sourceHtml, emotes);
    if (replacement.count === 0) return { body, formattedBody, hasCustomEmotes: false };

    return {
        body: normalizeQualifiedTokens(body, emotes),
        formattedBody: replacement.html,
        hasCustomEmotes: true,
    };
}

export function decorateCustomEmotesInContent(content: RoomMessageEventContent, emotes: CustomEmote[]): boolean {
    const textContent = content as RoomMessageTextEventContent;
    const decorated = decorateCustomEmotes(textContent.body, textContent.formatted_body, emotes);
    if (!decorated.hasCustomEmotes) return false;

    textContent.body = decorated.body;
    textContent.format = "org.matrix.custom.html";
    textContent.formatted_body = decorated.formattedBody;

    const newContent = (textContent as RoomMessageTextEventContent & { "m.new_content"?: RoomMessageTextEventContent })[
        "m.new_content"
    ];
    if (newContent) {
        const decoratedNewContent = decorateCustomEmotes(newContent.body, newContent.formatted_body, emotes);
        if (decoratedNewContent.hasCustomEmotes) {
            newContent.body = decoratedNewContent.body;
            newContent.format = "org.matrix.custom.html";
            newContent.formatted_body = decoratedNewContent.formattedBody;
        }
    }

    return true;
}

export function hasCustomEmotes(content: RoomMessageEventContent): boolean {
    const textContent = content as RoomMessageTextEventContent & { "m.new_content"?: RoomMessageTextEventContent };
    return Boolean(
        textContent.formatted_body?.includes("data-mx-emoticon") ||
        textContent["m.new_content"]?.formatted_body?.includes("data-mx-emoticon"),
    );
}

export function prepareCustomEmotesForEditing(html: string): EditableCustomEmoteContent {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const emotes: CustomEmote[] = [];

    for (const [index, image] of [...parsed.querySelectorAll<HTMLImageElement>("img[data-mx-emoticon]")].entries()) {
        const shortcode = image.title;
        const url = image.getAttribute("src") ?? "";
        if (!new RegExp(`^${SHORTCODE_PATTERN}$`).test(shortcode) || !url.startsWith("mxc://")) continue;

        const packSlug = `edited-${index + 1}`;
        const pack: ResolvedImagePack = {
            roomId: "",
            stateKey: packSlug,
            displayName: "Edited message",
            source: "room",
            content: { images: {} },
        };
        const emote: CustomEmote = {
            shortcode,
            url,
            body: image.alt || undefined,
            pack,
            packSlug,
            sendToken: `:${shortcode}/${packSlug}:`,
        };
        emotes.push(emote);
        image.replaceWith(emote.sendToken);
    }

    return { html: parsed.body.innerHTML, emotes };
}
/*
 * Image pack writer helpers.
 *
 * These helpers perform the writes that back in-Element image pack management
 * (MSC2545). They are written to round-trip through the same event types the
 * read helpers above already consume (`m.room.image_pack`,
 * `m.image_pack.rooms`, and the legacy `im.ponies.*` keys for compatibility),
 * so any newly written content shows up in the existing custom-emote
 * autocomplete / emoji picker without a restart.
 *
 * The writer and reader paths share the same wire representation.
 */

const IMAGE_PACK_USAGE_EMOTICON = "emoticon";

export interface EmoteEdit {
    shortcode: string;
    url: string;
    body?: string;
    info?: Record<string, unknown>;
}

export interface ImagePackDraft {
    displayName?: string;
    avatarUrl?: string;
    attribution?: string;
    usage?: string[];
    images?: Record<string, EmoteEdit>;
}

export interface GlobalPackReference {
    roomId: string;
    stateKey: string;
}

function cloneImagePackContent(content: ImagePackContent): ImagePackContent {
    const images: Record<string, ImagePackImage> = {};
    for (const [shortcode, image] of Object.entries(content.images)) {
        const cloned: ImagePackImage = { url: image.url };
        if (image.body !== undefined) cloned.body = image.body;
        if (image.info) cloned.info = { ...image.info };
        images[shortcode] = cloned;
    }
    if (!content.pack) return { images };
    const pack: ImagePackContent["pack"] = {};
    if (content.pack.display_name !== undefined) pack.display_name = content.pack.display_name;
    if (content.pack.avatar_url !== undefined) pack.avatar_url = content.pack.avatar_url;
    if (content.pack.attribution !== undefined) pack.attribution = content.pack.attribution;
    if (content.pack.usage !== undefined) pack.usage = [...content.pack.usage];
    return { images, pack };
}

function readCurrentPackEvent(
    client: MatrixClient,
    roomId: string,
    stateKey: string,
    type: typeof IMAGE_PACK_EVENT_TYPE | typeof LEGACY_IMAGE_PACK_EVENT_TYPE,
): { content: ImagePackContent; type: typeof type; eventId?: string } | null {
    const room = client.getRoom(roomId);
    if (!room) return null;
    const event = room.currentState.getStateEvents(type, stateKey);
    if (!event) return null;
    const content = parseImagePackContent(event.getContent());
    if (!content) return null;
    return { content, type, eventId: event.getId() };
}

function buildImagePackContent(draft: ImagePackDraft, previous?: ImagePackContent): ImagePackContent {
    const images: Record<string, ImagePackImage> = previous ? { ...previous.images } : {};
    if (draft.images) {
        for (const [shortcode, image] of Object.entries(draft.images)) {
            const cleaned: ImagePackImage = { url: image.url };
            if (image.body !== undefined) cleaned.body = image.body;
            if (image.info) cleaned.info = { ...image.info };
            images[shortcode] = cleaned;
        }
    }
    const pack: NonNullable<ImagePackContent["pack"]> = previous?.pack
        ? (cloneImagePackContent({ images, pack: previous.pack }).pack ?? {})
        : {};
    if (draft.displayName !== undefined) pack.display_name = draft.displayName;
    if (draft.avatarUrl !== undefined) pack.avatar_url = draft.avatarUrl;
    if (draft.attribution !== undefined) pack.attribution = draft.attribution;
    if (draft.usage !== undefined) pack.usage = [...draft.usage];
    return Object.keys(pack).length > 0 ? { images, pack } : { images };
}

function pickPackEventType(client: MatrixClient, roomId: string, stateKey: string): typeof IMAGE_PACK_EVENT_TYPE {
    // Prefer the stable `m.room.image_pack` event type. The legacy
    // `im.ponies.room_emotes` event is still read for backwards compatibility,
    // but new writes always go to the stable key.
    void client;
    void roomId;
    void stateKey;
    return IMAGE_PACK_EVENT_TYPE;
}

/**
 * Create or replace a pack in a room (state event). The returned promise
 * resolves with the new pack display name once the homeserver has accepted
 * the state event.
 */
export async function createRoomImagePack(
    client: MatrixClient,
    roomId: string,
    stateKey: string,
    draft: ImagePackDraft,
): Promise<void> {
    const content = buildImagePackContent(draft);
    const eventType = pickPackEventType(client, roomId, stateKey);
    await client.sendStateEvent(roomId, eventType as never, content as never, stateKey);
}

/**
 * Update only the pack-level metadata (display name / avatar / usage /
 * attribution). Image entries are left untouched. Throws if the pack does
 * not already exist; callers should use {@link createRoomImagePack} for
 * the initial create path.
 */
export async function updateRoomImagePackMetadata(
    client: MatrixClient,
    roomId: string,
    stateKey: string,
    draft: ImagePackDraft,
): Promise<void> {
    const existing =
        readCurrentPackEvent(client, roomId, stateKey, IMAGE_PACK_EVENT_TYPE) ??
        readCurrentPackEvent(client, roomId, stateKey, LEGACY_IMAGE_PACK_EVENT_TYPE);
    if (!existing) {
        throw new Error(
            `Cannot update room image pack ${stateKey} in ${roomId}: pack does not exist. ` +
                `Use createRoomImagePack() to create it first.`,
        );
    }
    const content = buildImagePackContent(draft, existing.content);
    await client.sendStateEvent(roomId, existing.type as never, content as never, stateKey);
}

/**
 * Add or update a single emote inside a room-scoped pack. If the pack does
 * not exist yet, it is created with emoticon usage and the supplied image.
 */
export async function upsertRoomPackEmote(
    client: MatrixClient,
    roomId: string,
    stateKey: string,
    emote: EmoteEdit,
): Promise<void> {
    const existing =
        readCurrentPackEvent(client, roomId, stateKey, IMAGE_PACK_EVENT_TYPE) ??
        readCurrentPackEvent(client, roomId, stateKey, LEGACY_IMAGE_PACK_EVENT_TYPE);
    const previous = existing?.content;
    const content = buildImagePackContent(
        { images: { [emote.shortcode]: emote }, ...(previous ? {} : { usage: [IMAGE_PACK_USAGE_EMOTICON] }) },
        previous,
    );
    const eventType = existing?.type ?? pickPackEventType(client, roomId, stateKey);
    await client.sendStateEvent(roomId, eventType as never, content as never, stateKey);
}

/**
 * Remove a single emote from a room-scoped pack. If the resulting pack has no
 * images and no useful metadata, the pack is left as an empty pack rather than
 * being deleted — state events in Matrix are immutable and the user must
 * explicitly delete the pack via {@link deleteRoomImagePack} if desired.
 */
export async function removeRoomPackEmote(
    client: MatrixClient,
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    const existing =
        readCurrentPackEvent(client, roomId, stateKey, IMAGE_PACK_EVENT_TYPE) ??
        readCurrentPackEvent(client, roomId, stateKey, LEGACY_IMAGE_PACK_EVENT_TYPE);
    if (!existing) return;
    const nextImages = { ...existing.content.images };
    delete nextImages[shortcode];
    const content: ImagePackContent = { ...existing.content, images: nextImages };
    await client.sendStateEvent(roomId, existing.type as never, content as never, stateKey);
}

/**
 * Redact the state event that holds a room image pack. This is the preferred
 * deletion path: a redacted state event does not appear at all in
 * `room.currentState`, so the picker cannot re-pick it. Requires the event
 * id of the state event (look it up via the resolver / read helpers).
 */
export async function redactRoomImagePack(client: MatrixClient, roomId: string, eventId: string): Promise<void> {
    await client.redactEvent(roomId, eventId);
}

export interface RoomImagePackOrder {
    stateKeys: string[];
}

export function getRoomImagePackOrder(client: MatrixClient, roomId: string): RoomImagePackOrder | null {
    const event = client.getAccountData(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE as never);
    const content = event?.getContent();
    if (!isRecord(content) || !isRecord(content.rooms) || !Array.isArray(content.rooms[roomId])) return null;
    const stateKeys: string[] = [];
    for (const entry of content.rooms[roomId]) {
        if (typeof entry === "string" && entry !== LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY) {
            stateKeys.push(entry);
        }
    }
    return { stateKeys };
}

/**
 * Reorder a room's image pack list in private account data. Ordering is a
 * per-user preference, so it must not be published as an invalid room state
 * event that can collide with a real pack state key.
 */
export async function reorderRoomImagePacks(
    client: MatrixClient,
    roomId: string,
    orderedStateKeys: string[],
): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE, (current) => {
            const rooms: Record<string, string[]> =
                isRecord(current) && isRecord(current.rooms)
                    ? Object.fromEntries(
                          Object.entries(current.rooms).flatMap(([id, value]) =>
                              Array.isArray(value)
                                  ? [[id, value.filter((key): key is string => typeof key === "string")]]
                                  : [],
                          ),
                      )
                    : {};
            rooms[roomId] = orderedStateKeys.filter((key) => key !== LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY);
            return { rooms };
        });
    });
}

/**
 * Delete a room pack through redaction when the current state event exposes
 * an id, falling back to an empty replacement for minimal test clients.
 */
export async function deleteRoomImagePack(client: MatrixClient, roomId: string, stateKey: string): Promise<void> {
    const existing =
        readCurrentPackEvent(client, roomId, stateKey, IMAGE_PACK_EVENT_TYPE) ??
        readCurrentPackEvent(client, roomId, stateKey, LEGACY_IMAGE_PACK_EVENT_TYPE);
    if (existing?.eventId) {
        await redactRoomImagePack(client, roomId, existing.eventId);
        return;
    }
    const eventType = existing?.type ?? pickPackEventType(client, roomId, stateKey);
    await client.sendStateEvent(
        roomId,
        eventType as never,
        { images: {}, pack: { usage: [IMAGE_PACK_USAGE_EMOTICON] } } as never,
        stateKey,
    );
}
function readRoomsContent(content: unknown): Record<string, Record<string, object>> {
    if (!isRecord(content) || !isRecord(content.rooms)) return {};
    const rooms: Record<string, Record<string, object>> = {};
    for (const [roomId, packs] of Object.entries(content.rooms)) {
        if (!isRecord(packs)) continue;
        rooms[roomId] = {};
        for (const [stateKey, value] of Object.entries(packs)) {
            rooms[roomId][stateKey] = isRecord(value) ? value : {};
        }
    }
    return rooms;
}

/**
 * Whether the given pack is already referenced for global use in either the
 * stable or legacy account-data keys.
 */
export function isGlobalPackEnabled(client: MatrixClient, reference: GlobalPackReference): boolean {
    for (const eventType of [IMAGE_PACK_ROOMS_EVENT_TYPE, LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE]) {
        const content = client.getAccountData(eventType as never)?.getContent();
        if (!isRecord(content) || !isRecord(content.rooms)) continue;
        const packs = content.rooms[reference.roomId];
        if (isRecord(packs) && reference.stateKey in packs) return true;
    }
    return false;
}

/**
 * Add (or update) a reference from the user's `m.image_pack.rooms` account
 * data so the referenced pack becomes globally available. Writes the
 * stable key and mirrors into the legacy `im.ponies.emote_rooms` key for
 * older clients.
 */
export async function enableGlobalPack(client: MatrixClient, reference: GlobalPackReference): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(IMAGE_PACK_ROOMS_EVENT_TYPE, (current) => {
            const stable = readRoomsContent(current);
            const stableRoom = { ...stable[reference.roomId] };
            stableRoom[reference.stateKey] = {};
            stable[reference.roomId] = stableRoom;
            return { rooms: stable };
        });

        await transaction.set(LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE, (current) => {
            const legacy = readRoomsContent(current);
            const legacyRoom = { ...legacy[reference.roomId] };
            legacyRoom[reference.stateKey] = {};
            legacy[reference.roomId] = legacyRoom;
            return { rooms: legacy };
        });
    });
}

/**
 * Remove a reference from the user's `m.image_pack.rooms` account data so
 * the pack is no longer available globally. Removes from both stable and
 * legacy keys.
 */
export async function disableGlobalPack(client: MatrixClient, reference: GlobalPackReference): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(IMAGE_PACK_ROOMS_EVENT_TYPE, (current) => {
            const stable = readRoomsContent(current);
            if (!stable[reference.roomId]) return undefined;
            const next = { ...stable[reference.roomId] };
            delete next[reference.stateKey];
            if (Object.keys(next).length === 0) delete stable[reference.roomId];
            else stable[reference.roomId] = next;
            return { rooms: stable };
        });

        await transaction.set(LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE, (current) => {
            const legacy = readRoomsContent(current);
            if (!legacy[reference.roomId]) return undefined;
            const next = { ...legacy[reference.roomId] };
            delete next[reference.stateKey];
            if (Object.keys(next).length === 0) delete legacy[reference.roomId];
            else legacy[reference.roomId] = next;
            return { rooms: legacy };
        });
    });
}

function readUserPackContent(content: unknown): ImagePackContent {
    return parseImagePackContent(content) ?? { images: {} };
}

/**
 * Update the user's personal (account-data) image pack. Writes the legacy
 * `im.ponies.user_emotes` key for backwards compatibility with existing
 * pickers. The stable `m.image_pack` key is not used at user scope per the
 * spec, so user packs are emulated with the legacy account-data event.
 */
export async function upsertUserImagePack(client: MatrixClient, draft: ImagePackDraft): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, (current) =>
            buildImagePackContent(draft, readUserPackContent(current)),
        );
    });
}

/** Create the account's personal image pack without replacing an existing one. */
export async function createUserImagePack(client: MatrixClient, pack: ImagePackDefinition): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, (current) => {
            if (hasVisiblePackContent(current)) {
                throw new Error("A personal image pack already exists. Add emotes to it or rename it instead.");
            }
            return buildImagePackContent({
                displayName: pack.displayName,
                avatarUrl: pack.avatarUrl,
                attribution: pack.attribution,
                usage: pack.usage,
                images: pack.images,
            });
        });
    });
}

/** Replace the complete personal pack, including removing images absent from the new definition. */
export async function replaceUserImagePack(client: MatrixClient, pack: ImagePackDefinition): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        const content = buildImagePackContent({
            displayName: pack.displayName,
            avatarUrl: pack.avatarUrl,
            attribution: pack.attribution,
            usage: pack.usage,
            images: pack.images,
        });
        await transaction.set(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, content);
    });
}

/** Remove the personal pack account-data event so an empty card is not left behind. */
export async function deleteUserImagePack(client: MatrixClient): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {});
    });
}

/**
 * Add or update a single emote in the user's personal image pack.
 */
export async function upsertUserPackEmote(client: MatrixClient, emote: EmoteEdit): Promise<void> {
    if (!SHORTCODE_REGEX.test(emote.shortcode)) throw new Error("Invalid custom emote shortcode");
    if (!emote.url.startsWith("mxc://")) throw new Error("Invalid custom emote media URL");
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, (existingContent) => {
            const hasPack =
                isRecord(existingContent) && (isRecord(existingContent.images) || isRecord(existingContent.pack));
            const previous = readUserPackContent(existingContent);
            return buildImagePackContent(
                { images: { [emote.shortcode]: emote }, ...(hasPack ? {} : { usage: [IMAGE_PACK_USAGE_EMOTICON] }) },
                previous,
            );
        });
    });
}

/** Check the synchronized personal pack before allowing a shortcode collision. */
export function hasUserPackEmote(client: MatrixClient, shortcode: string): boolean {
    const content = client.getAccountData(LEGACY_USER_IMAGE_PACK_EVENT_TYPE as never)?.getContent();
    return Boolean(readUserPackContent(content).images[shortcode]);
}

/**
 * Remove a single emote from the user's personal image pack.
 */
export async function removeUserPackEmote(client: MatrixClient, shortcode: string): Promise<void> {
    await runAccountDataTransaction(client, async (transaction) => {
        await transaction.set(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, (current) => {
            const previous = readUserPackContent(current);
            if (!previous.images[shortcode]) return undefined;
            const next: ImagePackContent = cloneImagePackContent(previous);
            delete next.images[shortcode];
            return next;
        });
    });
}

export async function uploadImageFromClient(client: MatrixClient, file: File): Promise<string> {
    const { content_uri: contentUri } = await client.uploadContent(file);
    if (!contentUri) throw new Error("The homeserver did not return a media URL.");
    return contentUri;
}

/**
 * Bridge a live `MatrixClient` to the `PackWriters` contract expected by the
 * `image-packs` module. This is the only place outside the module that
 * knows about both layers, and it lives in `custom-emotes.ts` so the
 * module can stay host-agnostic.
 */
export function createWritersFromClient(client: MatrixClient): PackWriters {
    return {
        createRoomImagePack: (roomId, stateKey, draft) => createRoomImagePack(client, roomId, stateKey, draft),
        updateRoomImagePackMetadata: (roomId, stateKey, draft) =>
            updateRoomImagePackMetadata(client, roomId, stateKey, draft),
        deleteRoomImagePack: (roomId, stateKey) => deleteRoomImagePack(client, roomId, stateKey),
        upsertRoomPackEmote: (roomId, stateKey, emote) => upsertRoomPackEmote(client, roomId, stateKey, emote),
        removeRoomPackEmote: (roomId, stateKey, shortcode) => removeRoomPackEmote(client, roomId, stateKey, shortcode),
        reorderRoomImagePacks: (roomId, orderedKeys) => reorderRoomImagePacks(client, roomId, orderedKeys),
        redactRoomImagePack: (roomId, eventId) => redactRoomImagePack(client, roomId, eventId),
        getRoomImagePackOrder: (roomId) => getRoomImagePackOrder(client, roomId),
        createUserImagePack: (pack) => createUserImagePack(client, pack),
        upsertUserImagePack: (pack) => upsertUserImagePack(client, pack),
        replaceUserImagePack: (pack) => replaceUserImagePack(client, pack),
        upsertUserPackEmote: (emote) => upsertUserPackEmote(client, emote),
        removeUserPackEmote: (shortcode) => removeUserPackEmote(client, shortcode),
        deleteUserImagePack: () => deleteUserImagePack(client),
        enableGlobalPack: (reference) => enableGlobalPack(client, reference),
        disableGlobalPack: (reference) => disableGlobalPack(client, reference),
    };
}
