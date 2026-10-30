/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * The Document Picture-in-Picture API (https://wicg.github.io/document-picture-in-picture/), which
 * TypeScript's DOM library does not describe yet. Chromium only at the time of writing.
 */
interface DocumentPictureInPictureOptions {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
}

interface DocumentPictureInPicture extends EventTarget {
    /** The currently open Picture-in-Picture window, if any. */
    readonly window: Window | null;
    /** Opens a Picture-in-Picture window. Requires a user gesture. */
    requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
}

interface Window {
    readonly documentPictureInPicture?: DocumentPictureInPicture;
}
