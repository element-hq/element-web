/*
 * Copyright 2021 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EncryptedFile, MediaEventContent } from "matrix-js-sdk/src/types";

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
