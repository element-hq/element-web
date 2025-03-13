/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2021 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type EncryptedFile, type MediaEventContent } from "matrix-js-sdk/src/types";

export interface IPreparedMedia extends IMediaObject {
    thumbnail?: IMediaObject;
}

export interface IMediaObject {
    mxc: string;
    file?: EncryptedFile;
}

/**
 * Parses an event content body into a prepared media object. This prepared media object
 * can be used with other functions to manipulate the media.
 * @param {MediaEventContent} content Unredacted media event content. See interface.
 * @returns {IPreparedMedia} A prepared media object.
 * @throws Throws if the given content cannot be packaged into a prepared media object.
 */
export function prepEventContentAsMedia(content: Partial<MediaEventContent>): IPreparedMedia {
    let thumbnail: IMediaObject | undefined;
    if (typeof content?.info === "object" && "thumbnail_url" in content.info && content.info.thumbnail_url) {
        thumbnail = {
            mxc: content.info.thumbnail_url,
            file: content.info.thumbnail_file,
        };
    } else if (
        typeof content?.info === "object" &&
        "thumbnail_file" in content.info &&
        typeof content?.info?.thumbnail_file === "object" &&
        content?.info?.thumbnail_file?.url
    ) {
        thumbnail = {
            mxc: content.info.thumbnail_file.url,
            file: content.info.thumbnail_file,
        };
    }

    if (content?.url) {
        return {
            thumbnail,
            mxc: content.url,
            file: content.file,
        };
    } else if (content?.file?.url) {
        return {
            thumbnail,
            mxc: content.file.url,
            file: content.file,
        };
    }

    throw new Error("Invalid file provided: cannot determine MXC URI. Has it been redacted?");
}
