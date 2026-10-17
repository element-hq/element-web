/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type {
    FileViewerOptions,
    FileViewerRenderFunction,
    FileViewerApi as IFileViewerApi,
    FileViewerMatcher,
    MediaHandle,
    UploadedMedia,
    RemoteMedia,
} from "@element-hq/element-web-module-api";
import type { UrlPreview } from "shared-types";
import { MediaEventHelper } from "../utils/MediaEventHelper";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { MediaEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

/**
 * A file viewer that is registered by the file viewer module api
 */
export type RegisteredFileViewer = {
    render: FileViewerRenderFunction;
    match: FileViewerMatcher;
    options: FileViewerOptions;
};

export class FileViewerApi implements IFileViewerApi {
    /**
     * Map<viewer ID, the actual content>
     */
    private readonly viewers: Map<string, RegisteredFileViewer> = new Map();

    public registerFileViewer(
        match: FileViewerMatcher,
        render: FileViewerRenderFunction,
        options: FileViewerOptions,
    ): void {
        if (this.viewers.has(options.id))
            throw new Error(`A file viewer with ID ${options.id} has already been registered`);

        this.viewers.set(options.id, { match, render, options });
    }

    public getViewersFor(event: MediaHandle): RegisteredFileViewer[] {
        // in the unlikely scenario where there are multiple viewers for the
        // same media tile, order them by ID so it is not completely random
        return Array.from(this.viewers.values())
            .filter((viewer) => {
                try {
                    return viewer.match(event);
                } catch (e) {
                    logger.error(`FileViewerApi matcher from ${viewer.options.id} failed. Reason: ${e}`)
                    return false;
                }
            })
            .sort((a, b) => a.options.id.localeCompare(b.options.id));
    }

    public getViewerById(id: string): RegisteredFileViewer | undefined {
        return this.viewers.get(id);
    }
}

export function uploadedMediaOfEvent(mxEvent: MatrixEvent, helper?: MediaEventHelper): UploadedMedia | undefined {
    if (!helper) {
        if (!MediaEventHelper.isEligible(mxEvent)) return;

        helper = new MediaEventHelper(mxEvent);
    }

    return {
        type: "uploaded",
        mimetype: mxEvent.getContent<MediaEventContent>().info?.mimetype,
        byteSize: mxEvent.getContent<MediaEventContent>().info?.size,
        name: helper.fileName,
        blob: () => helper.sourceBlob.value,
    };
}

/**
 *
 * The image URL is removed from the UrlPreview, but if
 * an image is in the bundle, it will still be in the preview.additionalBundleContent
 */
// This is because an encrypted image cannot be restored
// immediately without making any requests, for uniform behaviour
// in encrypted and unencrypted rooms, remove image for both of them
export function remoteMediaOfPreview(preview: UrlPreview): RemoteMedia | undefined {
    return {
        type: "remote",
        preview: {
            ...preview,
            image: undefined,
        },
    };
}

/**
 * Returns a unique ID for the media
 * @param media the media to identify
 * @param mxEvent the event the media comes from
 */
export function mediaHandleId(media: MediaHandle, mxEvent: MatrixEvent): string {
    switch (media.type) {
        case "remote":
            return `remote:${mxEvent.getId()}:${media.preview.link}`;
        case "uploaded":
            // An event carries at most one uploaded file
            return `uploaded:${mxEvent.getId()}`;
    }
}
