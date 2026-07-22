/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import escapeHtml from "escape-html";
import { KnownMembership, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent, type RoomMessageTextEventContent } from "matrix-js-sdk/src/types";

import { SDKContextClass } from "./contexts/SDKContextClass";

export const IMAGE_PACK_EVENT_TYPE = "m.room.image_pack";
export const LEGACY_IMAGE_PACK_EVENT_TYPE = "im.ponies.room_emotes";
export const IMAGE_PACK_ROOMS_EVENT_TYPE = "m.image_pack.rooms";
export const LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE = "im.ponies.emote_rooms";
export const LEGACY_USER_IMAGE_PACK_EVENT_TYPE = "im.ponies.user_emotes";

const MAX_CANONICAL_SPACE_DEPTH = 20;
const SHORTCODE_PATTERN = "[A-Za-z0-9_-]{1,100}";
const CUSTOM_EMOTE_TOKEN = new RegExp(`:(${SHORTCODE_PATTERN})(?:/(${SHORTCODE_PATTERN}))?:`, "g");

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

function isEmoticonPack(content: ImagePackContent): boolean {
    const usage = content.pack?.usage;
    return !Array.isArray(usage) || usage.length === 0 || usage.includes("emoticon");
}

function getPackEvents(room: Room): MatrixEvent[] {
    const events = new Map<string, MatrixEvent>();

    for (const event of room.currentState.getStateEvents(LEGACY_IMAGE_PACK_EVENT_TYPE)) {
        events.set(event.getStateKey() ?? "", event);
    }
    for (const event of room.currentState.getStateEvents(IMAGE_PACK_EVENT_TYPE)) {
        events.set(event.getStateKey() ?? "", event);
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
    if (!content || !isEmoticonPack(content)) return null;

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
    getCanonicalParent = (roomId: string): Room | null => {
        if (typeof client.getVisibleRooms !== "function") return null;
        return SDKContextClass.instance.spaceStore.getCanonicalParent(roomId);
    },
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
