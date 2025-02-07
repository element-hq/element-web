/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2021 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, parseErrorResponse, type ResizeMethod } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { type Optional } from "matrix-events-sdk";

import type { MediaCustomisations, Media } from "@element-hq/element-web-module-api";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { type IPreparedMedia, prepEventContentAsMedia } from "./models/IMediaEventContent";
import { UserFriendlyError } from "../languageHandler";

// Populate this class with the details of your customisations when copying it.

// Implementation note: The Media class must complete the contract as shown here, though
// the constructor can be whatever is relevant to your implementation. The mediaForX
// functions below create an instance of the Media class and are used throughout the
// project.

/**
 * A media object is a representation of a "source media" and an optional
 * "thumbnail media", derived from event contents or external sources.
 */
class MediaImplementation implements Media {
    private client: MatrixClient;

    // Per above, this constructor signature can be whatever is helpful for you.
    public constructor(
        private prepared: IPreparedMedia,
        client?: MatrixClient,
    ) {
        this.client = client ?? MatrixClientPeg.safeGet();
        if (!this.client) {
            throw new Error("No possible MatrixClient for media resolution. Please provide one or log in.");
        }
    }

    /**
     * True if the media appears to be encrypted. Actual file contents may vary.
     */
    public get isEncrypted(): boolean {
        return !!this.prepared.file;
    }

    /**
     * The MXC URI of the source media.
     */
    public get srcMxc(): string {
        return this.prepared.mxc;
    }

    /**
     * The MXC URI of the thumbnail media, if a thumbnail is recorded. Null/undefined
     * otherwise.
     */
    public get thumbnailMxc(): Optional<string> {
        return this.prepared.thumbnail?.mxc;
    }

    /**
     * Whether or not a thumbnail is recorded for this media.
     */
    public get hasThumbnail(): boolean {
        return !!this.thumbnailMxc;
    }

    /**
     * The HTTP URL for the source media.
     */
    public get srcHttp(): string | null {
        // eslint-disable-next-line no-restricted-properties
        return this.client.mxcUrlToHttp(this.srcMxc, undefined, undefined, undefined, false, true) || null;
    }

    /**
     * The HTTP URL for the thumbnail media (without any specified width, height, etc). Null/undefined
     * if no thumbnail media recorded.
     */
    public get thumbnailHttp(): string | null {
        if (!this.hasThumbnail) return null;
        // eslint-disable-next-line no-restricted-properties
        return this.client.mxcUrlToHttp(this.thumbnailMxc!, undefined, undefined, undefined, false, true);
    }

    /**
     * Gets the HTTP URL for the thumbnail media with the requested characteristics, if a thumbnail
     * is recorded for this media. Returns null/undefined otherwise.
     * @param {number} width The desired width of the thumbnail.
     * @param {number} height The desired height of the thumbnail.
     * @param {"scale"|"crop"} mode The desired thumbnailing mode. Defaults to scale.
     * @returns {string} The HTTP URL which points to the thumbnail.
     */
    public getThumbnailHttp(width: number, height: number, mode: ResizeMethod = "scale"): string | null {
        if (!this.hasThumbnail) return null;
        // scale using the device pixel ratio to keep images clear
        width = Math.floor(width * window.devicePixelRatio);
        height = Math.floor(height * window.devicePixelRatio);
        // eslint-disable-next-line no-restricted-properties
        return this.client.mxcUrlToHttp(this.thumbnailMxc!, width, height, mode, false, true);
    }

    /**
     * Gets the HTTP URL for a thumbnail of the source media with the requested characteristics.
     * @param {number} width The desired width of the thumbnail.
     * @param {number} height The desired height of the thumbnail.
     * @param {"scale"|"crop"} mode The desired thumbnailing mode. Defaults to scale.
     * @returns {string} The HTTP URL which points to the thumbnail.
     */
    public getThumbnailOfSourceHttp(width: number, height: number, mode: ResizeMethod = "scale"): string | null {
        // scale using the device pixel ratio to keep images clear
        width = Math.floor(width * window.devicePixelRatio);
        height = Math.floor(height * window.devicePixelRatio);
        // eslint-disable-next-line no-restricted-properties
        return this.client.mxcUrlToHttp(this.srcMxc, width, height, mode, false, true);
    }

    /**
     * Creates a square thumbnail of the media. If the media has a thumbnail recorded, that MXC will
     * be used, otherwise the source media will be used.
     * @param {number} dim The desired width and height.
     * @returns {string} An HTTP URL for the thumbnail.
     */
    public getSquareThumbnailHttp(dim: number): string | null {
        dim = Math.floor(dim * window.devicePixelRatio); // scale using the device pixel ratio to keep images clear
        if (this.hasThumbnail) {
            return this.getThumbnailHttp(dim, dim, "crop");
        }
        return this.getThumbnailOfSourceHttp(dim, dim, "crop");
    }

    /**
     * Downloads the source media.
     * @returns {Promise<Response>} Resolves to the server's response for chaining.
     */
    public async downloadSource(): Promise<Response> {
        const src = this.srcHttp;
        if (!src) {
            throw new UserFriendlyError("error|download_media");
        }
        const res = await fetch(src);
        if (!res.ok) {
            throw parseErrorResponse(res, await res.text());
        }
        return res;
    }
}

export type { Media };

type BaseMedia = MediaCustomisations<Partial<MediaEventContent>, MatrixClient, IPreparedMedia>;

/**
 * Creates a media object from event content.
 * @param {MediaEventContent} content The event content.
 * @param {MatrixClient} client Optional client to use.
 * @returns {MediaImplementation} The media object.
 */
export const mediaFromContent: BaseMedia["mediaFromContent"] = (
    content: Partial<MediaEventContent>,
    client?: MatrixClient,
): Media => new MediaImplementation(prepEventContentAsMedia(content), client);

/**
 * Creates a media object from an MXC URI.
 * @param {string} mxc The MXC URI.
 * @param {MatrixClient} client Optional client to use.
 * @returns {MediaImplementation} The media object.
 */
export const mediaFromMxc: BaseMedia["mediaFromMxc"] = (mxc?: string, client?: MatrixClient): Media => {
    return mediaFromContent({ url: mxc }, client);
};
