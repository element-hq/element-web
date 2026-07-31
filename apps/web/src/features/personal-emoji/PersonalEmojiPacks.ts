/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { mediaFromMxc } from "../../customisations/Media";

const DEFAULT_PERSONAL_PACK_EVENT = "im.ponies.user_emotes";
const CUSTOM_PERSONAL_PACK_EVENT = "in.cinny.user_emoji_packs";

export type PersonalEmojiUsage = "emoticon" | "sticker";

export interface PersonalEmojiItem {
    id: string;
    packId: string;
    shortcode: string;
    url: string;
    body?: string;
    keywords: string[];
    usage: PersonalEmojiUsage[];
    info?: Record<string, unknown>;
}

export interface PersonalEmojiPack {
    id: string;
    name: string;
    avatarUrl?: string;
    items: PersonalEmojiItem[];
}

type PackImage = {
    url?: unknown;
    body?: unknown;
    usage?: unknown;
    info?: unknown;
};

type PackContent = {
    pack?: {
        display_name?: unknown;
        avatar_url?: unknown;
        usage?: unknown;
    };
    images?: Record<string, PackImage>;
};

type UserPacksContent = {
    order?: unknown;
    packs?: Record<string, PackContent>;
};

const normaliseUsage = (value: unknown, fallback: PersonalEmojiUsage[]): PersonalEmojiUsage[] => {
    if (!Array.isArray(value)) return fallback;
    const usage = value.filter(
        (item): item is PersonalEmojiUsage => item === "emoticon" || item === "sticker",
    );
    return usage.length > 0 ? usage : fallback;
};

const readPack = (id: string, content: PackContent | undefined): PersonalEmojiPack | undefined => {
    if (!content || typeof content !== "object") return undefined;
    const meta = content.pack && typeof content.pack === "object" ? content.pack : undefined;
    const fallbackUsage = normaliseUsage(meta?.usage, ["emoticon", "sticker"]);
    const images = content.images && typeof content.images === "object" ? content.images : {};
    const items = Object.entries(images).flatMap(([shortcode, image]): PersonalEmojiItem[] => {
        if (!image || typeof image !== "object" || typeof image.url !== "string") return [];
        return [
            {
                id: `${id}:${shortcode}`,
                packId: id,
                shortcode,
                url: image.url,
                body: typeof image.body === "string" ? image.body : undefined,
                keywords: [shortcode, typeof image.body === "string" ? image.body : ""].filter(Boolean),
                usage: normaliseUsage(image.usage, fallbackUsage),
                info: image.info && typeof image.info === "object" ? image.info as Record<string, unknown> : undefined,
            },
        ];
    });
    if (items.length === 0) return undefined;

    return {
        id,
        name: typeof meta?.display_name === "string" && meta.display_name.trim() ? meta.display_name : "默认",
        avatarUrl: typeof meta?.avatar_url === "string" ? meta.avatar_url : items[0]?.url,
        items,
    };
};

/** Read the same account-data formats used by Spark/Cinny personal packs. */
export const getPersonalEmojiPacks = (client: MatrixClient): PersonalEmojiPack[] => {
    const defaultPack = readPack(
        "default",
        client.getAccountData(DEFAULT_PERSONAL_PACK_EVENT)?.getContent<PackContent>(),
    );
    const customContent = client.getAccountData(CUSTOM_PERSONAL_PACK_EVENT)?.getContent<UserPacksContent>();
    const customPacks = Object.entries(customContent?.packs ?? {})
        .map(([id, content]) => readPack(id, content))
        .filter((pack): pack is PersonalEmojiPack => Boolean(pack));
    const requestedOrder = Array.isArray(customContent?.order)
        ? customContent.order.filter((id): id is string => typeof id === "string")
        : [];
    const order = new Map(requestedOrder.map((id, index) => [id, index]));
    customPacks.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    return defaultPack ? [defaultPack, ...customPacks] : customPacks;
};

export const personalEmojiPreviewUrl = (item: PersonalEmojiItem, client: MatrixClient, size = 96): string =>
    item.url.startsWith("mxc://")
        ? (mediaFromMxc(item.url, client).getThumbnailOfSourceHttp(size, size, "scale") ?? item.url)
        : item.url;

