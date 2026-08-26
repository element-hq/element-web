/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { JSX } from "react/jsx-runtime";
import { UnstableBundledUrlPreviewSingle } from "../models/url-preview";

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
export type RemoteMedia = {
    type: "remote";
    bundle: UnstableBundledUrlPreviewSingle;
};

/**
 * a file that is uploaded to matrix
 */
export interface UploadedMedia {
    type: "uploaded";
    mimetype?: string;
    name: string;
    blob(): Promise<Blob>;
}

export interface FileViewerProps {
    media: MediaHandle;
    onClose: () => void;
}

export interface FileViewerOptions {
    /**
     * uniquely identifies the file viewer
     */
    id: string;
    /**
     * top bar title of the card
     */
    cardHeader: string;
    /**
     * tooltip/text for the "open" button in the file/url preview tile
     */
    buttonText: string;
    /**
     * icon for the button
     */
    buttonIcon: JSX.Element;
}

export type FileViewerRenderFunction = (props: FileViewerProps) => JSX.Element;

export interface FileViewerApi {
    registerFileViewer(match: FileViewerMatcher, renderer: FileViewerRenderFunction, opts: FileViewerOptions): void;
}
