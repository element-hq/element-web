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
} from "@element-hq/element-web-module-api";

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
