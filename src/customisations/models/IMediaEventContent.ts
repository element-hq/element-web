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

import { MsgType } from "matrix-js-sdk/src/matrix";

import { BLURHASH_FIELD } from "../../utils/image-media";

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#extensions-to-mroommessage-msgtypes
 */
export interface EncryptedFile {
    /**
     * The URL to the file.
     */
    url: string;
    /**
     * A JSON Web Key object.
     */
    key: {
        alg: string;
        key_ops: string[]; // eslint-disable-line camelcase
        kty: string;
        k: string;
        ext: boolean;
    };
    /**
     * The 128-bit unique counter block used by AES-CTR, encoded as unpadded base64.
     */
    iv: string;
    /**
     * A map from an algorithm name to a hash of the ciphertext, encoded as unpadded base64.
     * Clients should support the SHA-256 hash, which uses the key sha256.
     */
    hashes: { [alg: string]: string };
    /**
     * Version of the encrypted attachment's protocol. Must be v2.
     */
    v: string;
}

interface ThumbnailInfo {
    /**
     * The mimetype of the image, e.g. image/jpeg.
     */
    mimetype?: string;
    /**
     * The intended display width of the image in pixels.
     * This may differ from the intrinsic dimensions of the image file.
     */
    w?: number;
    /**
     * The intended display height of the image in pixels.
     * This may differ from the intrinsic dimensions of the image file.
     */
    h?: number;
    /**
     * Size of the image in bytes.
     */
    size?: number;
}

interface BaseInfo {
    mimetype?: string;
    size?: number;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mfile
 */
export interface FileInfo extends BaseInfo {
    /**
     * @see https://github.com/matrix-org/matrix-spec-proposals/pull/2448
     */
    [BLURHASH_FIELD]?: string;
    /**
     * Information on the encrypted thumbnail file, as specified in End-to-end encryption.
     * Only present if the thumbnail is encrypted.
     * @see https://spec.matrix.org/v1.7/client-server-api/#sending-encrypted-attachments
     */
    thumbnail_file?: EncryptedFile;
    /**
     * Metadata about the image referred to in thumbnail_url.
     */
    thumbnail_info?: ThumbnailInfo;
    /**
     * The URL to the thumbnail of the file. Only present if the thumbnail is unencrypted.
     */
    thumbnail_url?: string;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mimage
 *
 */
export interface ImageInfo extends FileInfo, ThumbnailInfo {}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mimage
 */
export interface AudioInfo extends BaseInfo {
    /**
     * The duration of the audio in milliseconds.
     */
    duration?: number;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mvideo
 */
export interface VideoInfo extends AudioInfo, ImageInfo {
    /**
     * The duration of the video in milliseconds.
     */
    duration?: number;
}

export type IMediaEventInfo = FileInfo | ImageInfo | AudioInfo | VideoInfo;

interface BaseContent {
    /**
     * Required if the file is encrypted. Information on the encrypted file, as specified in End-to-end encryption.
     * @see https://spec.matrix.org/v1.7/client-server-api/#sending-encrypted-attachments
     */
    file?: EncryptedFile;
    /**
     * Required if the file is unencrypted. The URL (typically mxc:// URI) to the file.
     */
    url?: string;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mfile
 */
export interface FileContent extends BaseContent {
    /**
     * A human-readable description of the file.
     * This is recommended to be the filename of the original upload.
     */
    body: string;
    /**
     * The original filename of the uploaded file.
     */
    filename?: string;
    /**
     * Information about the file referred to in url.
     */
    info?: FileInfo;
    /**
     * One of: [m.file].
     */
    msgtype: MsgType.File;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mimage
 */
export interface ImageContent extends BaseContent {
    /**
     * A textual representation of the image.
     * This could be the alt text of the image, the filename of the image,
     * or some kind of content description for accessibility e.g. ‘image attachment’.
     */
    body: string;
    /**
     * Metadata about the image referred to in url.
     */
    info?: ImageInfo;
    /**
     * One of: [m.image].
     */
    msgtype: MsgType.Image;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#maudio
 */
export interface AudioContent extends BaseContent {
    /**
     * A description of the audio e.g. ‘Bee Gees - Stayin’ Alive’,
     * or some kind of content description for accessibility e.g. ‘audio attachment’.
     */
    body: string;
    /**
     * Metadata for the audio clip referred to in url.
     */
    info?: AudioInfo;
    /**
     * One of: [m.audio].
     */
    msgtype: MsgType.Audio;
}

/**
 * @see https://spec.matrix.org/v1.7/client-server-api/#mvideo
 */
export interface VideoContent extends BaseContent {
    /**
     * A description of the video e.g. ‘Gangnam style’,
     * or some kind of content description for accessibility e.g. ‘video attachment’.
     */
    body: string;
    /**
     * Metadata about the video clip referred to in url.
     */
    info?: VideoInfo;
    /**
     * One of: [m.video].
     */
    msgtype: MsgType.Video;
}

/**
 * Type representing media event contents for `m.room.message` events listed in the Matrix specification
 */
export type IMediaEventContent = FileContent | ImageContent | AudioContent | VideoContent;

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
 * @param {IMediaEventContent} content Unredacted media event content. See interface.
 * @returns {IPreparedMedia} A prepared media object.
 * @throws Throws if the given content cannot be packaged into a prepared media object.
 */
export function prepEventContentAsMedia(content: Partial<IMediaEventContent>): IPreparedMedia {
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
