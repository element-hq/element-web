/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { type GalleryItem, galleryItemToMediaContent, getGalleryItems } from "./gallery";
import { type IDestroyable } from "./IDestroyable";
import { MediaEventHelper } from "./MediaEventHelper";
import { isMimeTypeAllowed } from "./blobs";

// Size the content repository is asked to scale thumbnails to. Matches the image message body.
const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_HEIGHT = 600;

/**
 * The media of one gallery item: resolves the URLs to display it, downloading and decrypting
 * where needed.
 */
export class GalleryMedia implements IDestroyable {
    /**
     * The item as the content of the equivalent standalone image or video message.
     */
    public readonly content: MediaEventContent;
    /**
     * Gives access to the source and thumbnail of the item.
     */
    public readonly helper: MediaEventHelper;

    public constructor(public readonly item: GalleryItem) {
        this.content = galleryItemToMediaContent(item);
        this.helper = MediaEventHelper.fromContent(this.content);
    }

    /**
     * Create the media of every displayable item of a gallery, in order.
     *
     * @param mxEvent - A gallery message.
     */
    public static forEvent(mxEvent: MatrixEvent): GalleryMedia[] {
        return getGalleryItems(mxEvent.getContent()).map((item) => new GalleryMedia(item));
    }

    /**
     * The mxc URI of the item, which identifies it within its gallery.
     */
    public get mxc(): string {
        return this.helper.media.srcMxc;
    }

    public get isVideo(): boolean {
        return this.item.itemtype === MsgType.Video;
    }

    /**
     * The file name of the item.
     */
    public get name(): string {
        return this.helper.fileName;
    }

    /**
     * Whether the bytes of the item must be fetched and held in memory to display it, rather than
     * being loaded by the browser from the content repository.
     */
    private get needsBlob(): boolean {
        return this.helper.media.isEncrypted || this.helper.isFromLocalUpload;
    }

    /**
     * Whether the browser may display the source of the item. Decrypted files are only shown
     * when their type is known to be safe to render from a blob.
     */
    private get canDisplaySource(): boolean {
        return !this.helper.media.isEncrypted || isMimeTypeAllowed(this.item.info?.mimetype ?? "");
    }

    /**
     * Resolve a small picture of the item to show in a grid.
     *
     * @returns A URL, or null for a video without a thumbnail.
     * @throws If the picture cannot be downloaded or decrypted, or an image has no form the
     *     browser may display.
     */
    public async getThumbnailUrl(): Promise<string | null> {
        const { media } = this.helper;

        if (this.needsBlob) {
            const thumbnail = await this.helper.thumbnailUrl.value;
            if (thumbnail || this.isVideo) return thumbnail;
            if (!this.canDisplaySource) throw new Error("Encrypted image has no thumbnail and cannot be displayed");
            return this.helper.sourceUrl.value;
        }

        if (this.isVideo) return media.thumbnailHttp;
        // The content repository cannot scale an SVG, so use the thumbnail the sender attached.
        if (this.item.info?.mimetype === "image/svg+xml" && media.hasThumbnail) {
            return media.getThumbnailHttp(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        }
        return media.getThumbnailOfSourceHttp(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
    }

    /**
     * Resolve the item at full size, to show in the media viewer.
     *
     * @returns A URL, or null if there is nothing the browser may display.
     * @throws If the media cannot be downloaded or decrypted.
     */
    public async getSourceUrl(): Promise<string | null> {
        if (!this.canDisplaySource) {
            // Fall back to the thumbnail, which is always an image.
            return this.isVideo ? null : this.helper.thumbnailUrl.value;
        }
        if (this.needsBlob) return this.helper.sourceUrl.value;
        return this.helper.media.srcHttp;
    }

    public destroy(): void {
        this.helper.destroy();
    }
}
