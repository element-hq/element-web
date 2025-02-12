/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { type FileContent, type ImageContent, type MediaEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { LazyValue } from "./LazyValue";
import { type Media, mediaFromContent } from "../customisations/Media";
import { decryptFile } from "./DecryptFile";
import { type IDestroyable } from "./IDestroyable";

// TODO: We should consider caching the blobs. https://github.com/vector-im/element-web/issues/17192

export class MediaEventHelper implements IDestroyable {
    // Either an HTTP or Object URL (when encrypted) to the media.
    public readonly sourceUrl: LazyValue<string | null>;
    public readonly thumbnailUrl: LazyValue<string | null>;

    // Either the raw or decrypted (when encrypted) contents of the file.
    public readonly sourceBlob: LazyValue<Blob>;
    public readonly thumbnailBlob: LazyValue<Blob | null>;

    public readonly media: Media;

    public constructor(private event: MatrixEvent) {
        this.sourceUrl = new LazyValue(this.prepareSourceUrl);
        this.thumbnailUrl = new LazyValue(this.prepareThumbnailUrl);
        this.sourceBlob = new LazyValue(this.fetchSource);
        this.thumbnailBlob = new LazyValue(this.fetchThumbnail);

        this.media = mediaFromContent(this.event.getContent());
    }

    public get fileName(): string {
        return (
            this.event.getContent<FileContent>().filename ||
            this.event.getContent<MediaEventContent>().body ||
            "download"
        );
    }

    public destroy(): void {
        if (this.media.isEncrypted) {
            if (this.sourceUrl.cachedValue) URL.revokeObjectURL(this.sourceUrl.cachedValue);
            if (this.thumbnailUrl.cachedValue) URL.revokeObjectURL(this.thumbnailUrl.cachedValue);
        }
    }

    private prepareSourceUrl = async (): Promise<string | null> => {
        if (this.media.isEncrypted) {
            const blob = await this.sourceBlob.value;
            return URL.createObjectURL(blob);
        } else {
            return this.media.srcHttp;
        }
    };

    private prepareThumbnailUrl = async (): Promise<string | null> => {
        if (this.media.isEncrypted) {
            const blob = await this.thumbnailBlob.value;
            if (blob === null) return null;
            return URL.createObjectURL(blob);
        } else {
            return this.media.thumbnailHttp;
        }
    };

    private fetchSource = (): Promise<Blob> => {
        if (this.media.isEncrypted) {
            const content = this.event.getContent<MediaEventContent>();
            return decryptFile(content.file!, content.info);
        }
        return this.media.downloadSource().then((r) => r.blob());
    };

    private fetchThumbnail = (): Promise<Blob | null> => {
        if (!this.media.hasThumbnail) return Promise.resolve(null);

        if (this.media.isEncrypted) {
            const content = this.event.getContent<ImageContent>();
            if (content.info?.thumbnail_file) {
                return decryptFile(content.info.thumbnail_file, content.info.thumbnail_info);
            } else {
                // "Should never happen"
                logger.warn("Media claims to have thumbnail and is encrypted, but no thumbnail_file found");
                return Promise.resolve(null);
            }
        }

        const thumbnailHttp = this.media.thumbnailHttp;
        if (!thumbnailHttp) return Promise.resolve(null);

        return fetch(thumbnailHttp).then((r) => r.blob());
    };

    public static isEligible(event: MatrixEvent): boolean {
        if (!event) return false;
        if (event.isRedacted()) return false;
        if (event.getType() === EventType.Sticker) return true;
        if (event.getType() !== EventType.RoomMessage) return false;

        const content = event.getContent();
        const mediaMsgTypes: string[] = [MsgType.Video, MsgType.Audio, MsgType.Image, MsgType.File];
        if (mediaMsgTypes.includes(content.msgtype!)) return true;
        if (typeof content.url === "string") return true;

        // Finally, it's probably not media
        return false;
    }
}
