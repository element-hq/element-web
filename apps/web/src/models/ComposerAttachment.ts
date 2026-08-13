/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _t } from "../languageHandler";
import { fileSize } from "../utils/FileUtils";
import { blobIsAnimated, mayBeAnimated } from "../utils/Image";
import { imageFormatLabel, sniffVideoCodec, videoContainerLabel } from "../utils/MediaFormat";

export type ComposerAttachmentKind = "image" | "video" | "file";

let nextAttachmentId = 0;

/**
 * A file staged in the composer. Nothing is uploaded until the message is sent.
 */
export class ComposerAttachment {
    public readonly id: string;
    public readonly kind: ComposerAttachmentKind;
    /** Only set for kinds we can preview. */
    public readonly previewUrl?: string;
    /** Size, plus format details once they have been read off the file. */
    public description: string;

    public constructor(public readonly file: File) {
        this.id = `mx_composer_attachment_${nextAttachmentId++}`;
        this.kind = kindForMimeType(file.type);
        this.description = humanSize(file.size);
        if (this.kind !== "file") {
            this.previewUrl = URL.createObjectURL(file);
        }
    }

    public get name(): string {
        return this.file.name || _t("common|attachment");
    }

    public get size(): number {
        return this.file.size;
    }

    /**
     * Read format details off the file, e.g. "1.2 MB - JPEG". Resolves true if the
     * description changed, so the caller knows to re-render.
     */
    public async loadDescription(): Promise<boolean> {
        const details = await this.formatDetails();
        if (!details) return false;

        const description = `${humanSize(this.size)} - ${details}`;
        if (description === this.description) return false;
        this.description = description;
        return true;
    }

    private async formatDetails(): Promise<string | undefined> {
        switch (this.kind) {
            case "image": {
                const format = imageFormatLabel(this.file.type);
                if (!format) return undefined;
                if (mayBeAnimated(this.file.type) && (await blobIsAnimated(this.file))) {
                    return _t("composer|attachments_animated_format", { format });
                }
                return format;
            }
            case "video": {
                const container = videoContainerLabel(this.file.type, this.name);
                const codec = await sniffVideoCodec(this.file);
                if (!container) return codec;
                return codec ? `${container}/${codec}` : container;
            }
            default:
                return undefined;
        }
    }

    /** Object URLs live until revoked, so every dropped attachment must be disposed. */
    public dispose(): void {
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
        }
    }
}

function humanSize(bytes: number): string {
    return fileSize(bytes, { base: 2, standard: "jedec" });
}

function kindForMimeType(mimeType: string): ComposerAttachmentKind {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    return "file";
}
