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

// TODO: These types should be elsewhere.

export interface IEncryptedFile {
    url: string;
    key: {
        alg: string;
        key_ops: string[]; // eslint-disable-line camelcase
        kty: string;
        k: string;
        ext: boolean;
    };
    iv: string;
    hashes: { [alg: string]: string };
    v: string;
}

export interface IMediaEventInfo {
    thumbnail_url?: string; // eslint-disable-line camelcase
    thumbnail_file?: IEncryptedFile; // eslint-disable-line camelcase
    thumbnail_info?: {
        // eslint-disable-line camelcase
        mimetype: string;
        w?: number;
        h?: number;
        size?: number;
    };
    mimetype: string;
    w?: number;
    h?: number;
    size?: number;
}

export interface IMediaEventContent {
    msgtype: string;
    body?: string;
    filename?: string; // `m.file` optional field
    url?: string; // required on unencrypted media
    file?: IEncryptedFile; // required for *encrypted* media
    info?: IMediaEventInfo;
}

export interface IPreparedMedia extends IMediaObject {
    thumbnail?: IMediaObject;
}

export interface IMediaObject {
    mxc: string;
    file?: IEncryptedFile;
}

/**
 * Parses an event content body into a prepared media object. This prepared media object
 * can be used with other functions to manipulate the media.
 * @param {IMediaEventContent} content Unredacted media event content. See interface.
 * @returns {IPreparedMedia} A prepared media object.
 * @throws Throws if the given content cannot be packaged into a prepared media object.
 */
export function prepEventContentAsMedia(content: Partial<IMediaEventContent>): IPreparedMedia {
    let thumbnail: IMediaObject | undefined;
    if (content?.info?.thumbnail_url) {
        thumbnail = {
            mxc: content.info.thumbnail_url,
            file: content.info.thumbnail_file,
        };
    } else if (content?.info?.thumbnail_file?.url) {
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
