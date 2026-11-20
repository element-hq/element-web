/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type ImageInfo, type VideoInfo } from "matrix-js-sdk/src/types";

import { _t } from "../languageHandler";
import { type IDestroyable } from "./IDestroyable";

/**
 * An image or video file on the user's device which has not been sent yet, such as an attachment
 * of a message being written, shown in the media viewer. The counterpart of `GalleryMedia` for
 * media which is already part of a message.
 */
export class LocalMedia implements IDestroyable {
    private sourceUrl?: string;

    public constructor(private readonly file: File) {}

    /**
     * The file name.
     */
    public get name(): string {
        return this.file.name || _t("common|attachment");
    }

    public get isVideo(): boolean {
        return this.file.type.startsWith("video/");
    }

    /**
     * What is known about the file before it is opened.
     */
    public get info(): ImageInfo & VideoInfo {
        return { size: this.file.size, mimetype: this.file.type };
    }

    /**
     * There is no event to download the media from: the viewer downloads it from its source URL.
     */
    public get helper(): undefined {
        return undefined;
    }

    /**
     * Resolve a URL the browser can show the file from.
     */
    public async getSourceUrl(): Promise<string> {
        this.sourceUrl ??= URL.createObjectURL(this.file);
        return this.sourceUrl;
    }

    public destroy(): void {
        if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
        this.sourceUrl = undefined;
    }
}
