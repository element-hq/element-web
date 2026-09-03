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
    UnstableBundledUrlPreviewSingle,
} from "@element-hq/element-web-module-api";
import { MediaEventHelper } from "../utils/MediaEventHelper";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { MediaEventContent } from "matrix-js-sdk/src/types";
import { RoomMessageEventContent } from "../../@types/url-preview";

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

export function uploadedMediaForEvent(mxEvent: MatrixEvent, helper?: MediaEventHelper): UploadedMedia | undefined {
    if (!helper) {
        if (!MediaEventHelper.isEligible(mxEvent)) return;

        helper = new MediaEventHelper(mxEvent);
    }

    return {
        type: "uploaded",
        uri: helper.media.srcMxc,
        mimetype: mxEvent.getContent<MediaEventContent>().info?.mimetype,
        name: helper.fileName,
        blob: () => helper.sourceBlob.value,
    };
}

export function remoteMediaForBundle(bundle: UnstableBundledUrlPreviewSingle): RemoteMedia {
    return {
        type: "remote",
        bundle,
    };
}

export function remoteMediaForEvent(mxEvent: MatrixEvent, url: string): RemoteMedia | undefined {
    const content = mxEvent.getContent<RoomMessageEventContent>();
    const foundBundle = (content["com.beeper.linkpreviews"] ?? []).find((bundle) => bundle.matched_url === url);

    if (foundBundle === undefined) return;

    return {
        type: "remote",
        bundle: foundBundle,
    };
}
