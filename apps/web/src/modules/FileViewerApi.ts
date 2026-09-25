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
        return Array.from(this.viewers.values())
            .filter((viewer) => viewer.match(event))
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
