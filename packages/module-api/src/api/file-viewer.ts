/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { JSX } from "react/jsx-runtime";

/**
 * the media content given to the component for rendering
 */
export type MediaHandle = RemoteMedia | UploadedMedia;

/**
 * predicate for whether the file viewer supports that media
 */
export type FileViewerMatcher = (media: MediaHandle) => boolean;

/**
 * a file that is given only by a URL, e.g. a PDF file uploaded to a 3rd party site
 */
export interface RemoteMedia {
    type: "remote";
    url: string;
    bundle?: Record<string, any>;
}

/**
 * a file that is uploaded to matrix
 */
export interface UploadedMedia {
    type: "uploaded";
    mimetype: string;
    name: string;
    blob?(): Promise<Blob>;
}

export interface FileViewerProps {
    media: MediaHandle;
    onclose: () => void;
}

export interface FileViewerOptions {
    /**
     * uniquely identifies the file viewer
     */
    id: string;
    /**
     * tab title displayed for the viewer
     */
    label: string;
}

export type FileViewerRenderFunction = (props: FileViewerProps) => JSX.Element;

export interface FileViewerApi {
    registerFileViewer(match: FileViewerMatcher, renderer: FileViewerRenderFunction, opts: FileViewerOptions): void;
}
