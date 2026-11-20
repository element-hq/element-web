/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type IContent, type IMentions, type MatrixEvent, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile, type ImageInfo, type MediaEventContent, type VideoInfo } from "matrix-js-sdk/src/types";
import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";

import { _t } from "../languageHandler";

/**
 * The `msgtype` of a gallery message, as defined by MSC4274.
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4274
 */
export const GALLERY_MSGTYPE = new UnstableValue("m.gallery", "dm.filament.gallery");

/**
 * The most items a gallery may hold, matching Element X.
 */
export const MAX_GALLERY_ITEMS = 60;

/**
 * The item types a gallery can display. MSC4274 also allows audio and file items, which no client
 * sends in a gallery and which are skipped when rendering.
 */
export type GalleryItemType = MsgType.Image | MsgType.Video;

/**
 * One image or video of a gallery. Has the shape of an `m.image` or `m.video` message content,
 * with `itemtype` in place of `msgtype`.
 */
export interface GalleryItem {
    itemtype: GalleryItemType;
    /** The file name, or the caption of the item when `filename` is also set. */
    body: string;
    filename?: string;
    url?: string;
    file?: EncryptedFile;
    info?: ImageInfo & VideoInfo;
}

/**
 * The content of a gallery message.
 */
export interface GalleryContent {
    msgtype: string;
    /** The caption of the gallery. Empty when there is none. */
    body: string;
    format?: "org.matrix.custom.html";
    formatted_body?: string;
    itemtypes: GalleryItem[];
}

/**
 * The text that goes with a gallery, or with a single image or video: the text fields of a
 * message content, as built by the message composer.
 */
export interface MediaCaption {
    /** The caption as plain text. Empty when there is none. */
    "body": string;
    "format"?: "org.matrix.custom.html";
    "formatted_body"?: string;
    /** The people mentioned in the caption, if that was worked out when it was written. */
    "m.mentions"?: IMentions;
}

/**
 * Take the caption for media out of the content of a text message.
 *
 * @param content - Message content built by the composer for the text the user typed.
 */
export function captionFromMessageContent(content: IContent): MediaCaption {
    const caption: MediaCaption = { body: typeof content.body === "string" ? content.body : "" };
    if (content.format === "org.matrix.custom.html" && typeof content.formatted_body === "string") {
        caption.format = content.format;
        caption.formatted_body = content.formatted_body;
    }
    if (content["m.mentions"]) caption["m.mentions"] = content["m.mentions"];
    return caption;
}

/**
 * Check whether a message content is a gallery.
 *
 * @param content - The content of an `m.room.message` event.
 */
export function isGalleryContent(content: IContent | undefined): boolean {
    const msgtype: unknown = content?.msgtype;
    return typeof msgtype === "string" && GALLERY_MSGTYPE.matches(msgtype);
}

/**
 * Check whether an event is a gallery message.
 *
 * @param mxEvent - The event to check.
 */
export function isGalleryEvent(mxEvent: MatrixEvent): boolean {
    return mxEvent.getType() === EventType.RoomMessage && isGalleryContent(mxEvent.getContent());
}

function isGalleryItem(item: unknown): item is GalleryItem {
    if (!item || typeof item !== "object") return false;
    const { itemtype, url, file } = item as Partial<GalleryItem>;
    if (itemtype !== MsgType.Image && itemtype !== MsgType.Video) return false;
    return typeof url === "string" || typeof file?.url === "string";
}

/**
 * Get the items of a gallery that can be displayed.
 *
 * Items which are malformed, have no media or are of a type we cannot show are left out, so one
 * bad item does not prevent the rest of the gallery from rendering.
 *
 * @param content - The content of a gallery message.
 */
export function getGalleryItems(content: IContent | undefined): GalleryItem[] {
    const items: unknown = content?.itemtypes;
    if (!Array.isArray(items)) return [];
    return items.filter(isGalleryItem);
}

/**
 * Get the caption of a gallery, if it has one.
 *
 * @param content - The content of a gallery message.
 */
export function getGalleryCaption(content: IContent | undefined): string | undefined {
    const body: unknown = content?.body;
    return typeof body === "string" && body.trim() ? body : undefined;
}

/**
 * Convert a gallery item into the content of the equivalent standalone media message, so it can
 * be handled by code written for `m.image` and `m.video` events.
 *
 * @param item - The gallery item.
 */
export function galleryItemToMediaContent(item: GalleryItem): MediaEventContent {
    const { itemtype, ...rest } = item;
    return { ...rest, msgtype: itemtype };
}

/**
 * Convert the content of a standalone image or video message into the equivalent gallery item,
 * the reverse of {@link galleryItemToMediaContent}. The caption of the message is left behind.
 *
 * @param content - The content of an `m.room.message` event.
 * @returns The item, or undefined if the content is not an image or video message with media.
 */
export function mediaContentToGalleryItem(content: IContent | undefined): GalleryItem | undefined {
    if (!content) return undefined;
    const item = {
        itemtype: content.msgtype,
        // With a caption the file name is in `filename`, without one it is the body.
        body: content.filename || content.body,
        url: content.url,
        file: content.file,
        info: content.info,
    };
    return isGalleryItem(item) ? item : undefined;
}

/**
 * Get the images and videos of a message, whichever way it holds them.
 *
 * @param content - The content of an `m.room.message` event.
 * @returns The items of a gallery, the one item of an image or video message, or undefined for
 *     any other message.
 */
export function getMessageMediaItems(content: IContent | undefined): GalleryItem[] | undefined {
    if (isGalleryContent(content)) return getGalleryItems(content);
    const item = mediaContentToGalleryItem(content);
    return item ? [item] : undefined;
}

/**
 * Get the images and videos of a message which can be changed while editing it.
 *
 * @param content - The content of an `m.room.message` event.
 * @returns The items of a gallery or image or video message, none for a text message which images
 *     and videos can be added to, or undefined for any other message.
 */
export function getEditableMediaItems(content: IContent | undefined): GalleryItem[] | undefined {
    if (content?.msgtype === MsgType.Text) return [];
    return getMessageMediaItems(content);
}

/**
 * Get the caption of a message with images or videos: the text fields of its content, or an
 * empty body if it has none. The caption of a text message is its text.
 *
 * @param content - The content of a gallery, image, video or text message.
 */
export function getMessageMediaCaption(content: IContent | undefined): MediaCaption {
    // The body of an image or video is its file name unless `filename` says otherwise.
    const hasCaption =
        content?.msgtype === MsgType.Text ||
        isGalleryContent(content) ||
        (!!content?.filename && content.filename !== content.body);
    if (!hasCaption || !getGalleryCaption(content)) return { body: "" };
    const { "m.mentions": _mentions, ...caption } = captionFromMessageContent(content!);
    return caption;
}

/**
 * Describe a gallery in a short line of text, for the places that show a message without
 * rendering it: the room list, notifications and reply quotes.
 *
 * @param content - The content of a gallery message.
 * @returns The caption if the gallery has one, otherwise the number of items it holds.
 */
export function getGallerySummary(content: IContent | undefined): string {
    return (
        getGalleryCaption(content)?.trim() ??
        _t("timeline|m.gallery|summary", { count: getGalleryItems(content).length })
    );
}

/**
 * Check whether a file can be an item of a gallery.
 *
 * @param file - A file the user wants to send.
 */
export function isGalleryFile(file: File): boolean {
    return file.type.startsWith("image/") || file.type.startsWith("video/");
}

// The largest event a homeserver accepts, in bytes, as set by the Matrix specification.
const MAX_EVENT_SIZE = 65536;
// Room left for the parts of the event that surround the content: its envelope, relations and mentions.
const EVENT_OVERHEAD_SIZE = 4096;

function jsonSize(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Split the items of a gallery into as many galleries as it takes for each to fit in one event.
 *
 * MSC4274 stores every item inline, so the event size limit caps how many a gallery can hold.
 * The cap depends on the items: around 60 for typical images, fewer in encrypted rooms.
 *
 * @param items - The items to send, in order.
 * @param caption - The text fields of the content, which take up room in the first event.
 * @param encrypted - Whether the event will be encrypted.
 * @returns The items of each gallery to send. A single entry unless the items do not fit.
 */
export function splitGalleryItems(
    items: GalleryItem[],
    caption: Partial<MediaCaption>,
    encrypted: boolean,
): GalleryItem[][] {
    // Encrypting an event base64-encodes its content, which makes it a third larger.
    const budget = (MAX_EVENT_SIZE - EVENT_OVERHEAD_SIZE) * (encrypted ? 3 / 4 : 1);

    const galleries: GalleryItem[][] = [[]];
    let size = jsonSize(caption);
    for (const item of items) {
        const itemSize = jsonSize(item) + 1;
        const current = galleries[galleries.length - 1];
        if (current.length > 0 && (size + itemSize > budget || current.length >= MAX_GALLERY_ITEMS)) {
            galleries.push([item]);
            size = itemSize;
        } else {
            current.push(item);
            size += itemSize;
        }
    }
    return galleries;
}
