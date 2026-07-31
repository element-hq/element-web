/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { EventType, type IContent, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { type ImageInfo } from "matrix-js-sdk/src/types";

import SdkConfig from "../../SdkConfig";
import { uploadFile } from "../../ContentMessages";
import { doMaybeLocalRoomAction } from "../../utils/local-room";
import { mediaFromMxc } from "../../customisations/Media";
import { addReplyToMessageContent } from "../../utils/Reply";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_PREFIX = "element.remote-sticker-index.v1:";
const PACK_ORDER_PREFIX = "element.remote-sticker-pack-order.v1:";

export interface RemoteSticker {
    id?: string;
    packId?: string;
    packName?: string;
    name?: string;
    fileName?: string;
    keywords?: string[];
    mxc?: string;
    mxcUrl?: string;
    matrixUrl?: string;
    url?: string;
    httpUrl?: string;
    sourceUrl?: string;
    previewUrl?: string;
    thumbUrl?: string;
    thumbnailUrl?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
}

export interface RemoteStickerPack {
    id?: string;
    name?: string;
}

export interface RemoteStickerIndex {
    packs?: RemoteStickerPack[];
    items?: RemoteSticker[];
}

const isMxc = (url?: string): url is string => Boolean(url?.startsWith("mxc://"));
const isHttp = (url?: string): url is string => Boolean(url && /^https?:\/\//i.test(url));
const findUrl = (urls: Array<string | undefined>): string | undefined => urls.find((url) => isMxc(url) || isHttp(url));

export const getRemoteStickerIndexUrl = (): string | undefined =>
    SdkConfig.get("remote_sticker_index_url")?.trim() || undefined;

export const getRemoteStickerPackOrder = (): string[] => {
    const url = getRemoteStickerIndexUrl();
    if (!url) return [];
    try {
        const value = JSON.parse(localStorage.getItem(`${PACK_ORDER_PREFIX}${url}`) ?? "[]");
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
    } catch {
        return [];
    }
};

export const setRemoteStickerPackOrder = (order: string[]): void => {
    const url = getRemoteStickerIndexUrl();
    if (!url) return;
    localStorage.setItem(`${PACK_ORDER_PREFIX}${url}`, JSON.stringify([...new Set(order)]));
};

export const stickerName = (sticker: RemoteSticker): string =>
    sticker.name?.trim() || sticker.fileName?.replace(/\.[^.]+$/, "") || "sticker";

export const stickerSearchText = (sticker: RemoteSticker): string =>
    [stickerName(sticker), sticker.fileName, sticker.packName, ...(sticker.keywords ?? [])]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLocaleLowerCase();

export const stickerMediaUrl = (sticker: RemoteSticker): string | undefined =>
    findUrl([sticker.mxc, sticker.mxcUrl, sticker.matrixUrl, sticker.url, sticker.httpUrl, sticker.sourceUrl]);

export const stickerPreviewUrl = (sticker: RemoteSticker, client: MatrixClient): string | undefined => {
    const url = findUrl([
        sticker.thumbUrl,
        sticker.thumbnailUrl,
        sticker.previewUrl,
        sticker.httpUrl,
        sticker.sourceUrl,
        sticker.url,
        sticker.mxc,
        sticker.mxcUrl,
    ]);
    return isMxc(url) ? (mediaFromMxc(url, client).getThumbnailOfSourceHttp(96, 96, "scale") ?? undefined) : url;
};

const getCachedIndex = (url: string): RemoteStickerIndex | undefined => {
    try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${url}`);
        if (!raw) return undefined;
        const cache = JSON.parse(raw) as { cachedAt?: unknown; index?: unknown };
        if (typeof cache.cachedAt !== "number" || Date.now() - cache.cachedAt > CACHE_TTL_MS) return undefined;
        if (!cache.index || typeof cache.index !== "object") return undefined;
        return cache.index;
    } catch {
        return undefined;
    }
};

const setCachedIndex = (url: string, index: RemoteStickerIndex): void => {
    try {
        localStorage.setItem(`${CACHE_PREFIX}${url}`, JSON.stringify({ cachedAt: Date.now(), index }));
    } catch {
        // Cache failures (for example private browsing) do not prevent sticker use.
    }
};

export const loadRemoteStickerIndex = async (url = getRemoteStickerIndexUrl()): Promise<RemoteStickerIndex> => {
    if (!url) throw new Error("尚未配置云端表情索引地址");
    const cached = getCachedIndex(url);
    if (cached) return cached;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`云端表情索引加载失败（${response.status}）`);
    const index = (await response.json()) as RemoteStickerIndex;
    setCachedIndex(url, index);
    return index;
};

/**
 * Sends with Element's uploadFile helper. HTTP images are always copied to Matrix first;
 * destination-room encryption is therefore retained. MXC-native index entries keep their MXC.
 */
export const sendRemoteSticker = async (
    room: Room,
    threadId: string | null | undefined,
    sticker: RemoteSticker,
    replyToEvent?: MatrixEvent,
): Promise<void> => {
    const sourceUrl = stickerMediaUrl(sticker);
    if (!sourceUrl) throw new Error("此云端表情没有可发送的媒体地址");
    const info: ImageInfo = {
        mimetype: sticker.mimeType || "image/*",
        size: sticker.size,
        w: sticker.width,
        h: sticker.height,
    };
    const content: IContent = { body: stickerName(sticker), info };

    if (isMxc(sourceUrl)) {
        content.url = sourceUrl;
    } else {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`下载云端表情失败（${response.status}）`);
        const blob = await response.blob();
        const file = new File([blob], sticker.fileName || stickerName(sticker), {
            type: sticker.mimeType || blob.type || "application/octet-stream",
        });
        Object.assign(content, await uploadFile(room.client, room.roomId, file));
    }

    // Stickers are their own event type, so the composer cannot add this relation
    // for us. Keep their reply behaviour identical to text, files and polls.
    if (replyToEvent) addReplyToMessageContent(content, replyToEvent);

    await doMaybeLocalRoomAction(
        room.roomId,
        // The SDK's public StickerEventContent type predates encrypted `file` attachments.
        // uploadFile returns the standards-compliant encrypted shape when it is needed.
        (actualRoomId) => room.client.sendEvent(actualRoomId, threadId ?? null, EventType.Sticker, content as never),
        room.client,
    );
};
