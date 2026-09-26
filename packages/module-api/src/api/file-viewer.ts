/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { JSX } from "react/jsx-runtime";
import type { UrlPreview } from "shared-types";

/**
 * The media content given to the component for rendering
 * @alpha Subject to change.
 */
export type MediaHandle = RemoteMedia | UploadedMedia;

/**
 * Predicate for whether the file viewer supports that media
 * @alpha Subject to change.
 */
export type FileViewerMatcher = (media: MediaHandle) => boolean;

/**
 * a file that is given only by a URL, e.g. a PDF file uploaded to a 3rd party site
 * @alpha Subject to change.
 */
export type RemoteMedia = {
    type: "remote";
    preview: UrlPreview;
};

/**
 * a file that is uploaded to matrix
 * @alpha Subject to change.
 */
export interface UploadedMedia {
    type: "uploaded";
    mimetype?: string;
    byteSize?: number;
    name: string;
    /** async function if called, fetches the media blob */
    blob(): Promise<Blob>;
}

/**
 * @alpha Subject to change.
 */
export interface FileViewerProps {
    /** media to preview */
    media: MediaHandle;
    /** function to close its own card */
    onClose: () => void;
}

/**
 * @alpha Subject to change.
 */
export interface FileViewerOptions {
    /**
     * uniquely identifies the file viewer
     */
    id: string;
    /**
     * top bar title of the card, computed from MediaHandle
     */
    cardHeader: (media: MediaHandle) => string;
    /**
     * tooltip/text for the "open" button in the file/url preview tile
     */
    buttonText: string;
    /**
     * icon for the button
     */
    buttonIcon: JSX.Element;
}

/**
 * Renders the file viewer for the given props
 * @alpha Subject to change.
 */
export type FileViewerRenderFunction = (props: FileViewerProps) => JSX.Element;

/**
 * API for adding file preview support for more media types
 * @alpha Subject to change.
 */
export interface FileViewerApi {
    /**
     * Register a file viewer
     * @param match whether the registered file viewer supports this media type
     * @param renderer renders the file viewer after the matcher returns true
     * @param opts properties of the file viewer
     * @alpha Subject to change.
     */
    registerFileViewer(match: FileViewerMatcher, renderer: FileViewerRenderFunction, opts: FileViewerOptions): void;
}
