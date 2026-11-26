/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type EncryptedFile,
    type RoomMessageEventContent as SdkRoomMessageEventContent,
} from "matrix-js-sdk/src/types";

/**
 * Bundled URL previews in MSC4095
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
interface BundledUrlPreviews {
    "m.url_previews"?: BundledUrlPreview[];
}

/**
 * Bundled URL previews as they were sent before MSC4095 was accepted.
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
interface UnstableBundledUrlPreviews {
    "com.beeper.linkpreviews"?: UnstableBundledUrlPreviewSingle[];
}

/**
 * The fields of a bundled URL preview that are named the same in the stable and unstable formats.
 */
interface BundledUrlPreviewOpenGraph {
    "matrix:image:size"?: number;
    "og:image"?: string;
    "og:url"?: string;
    "og:image:width"?: number;
    "og:image:height"?: number;
    "og:image:type"?: string;
    "og:title"?: string;
    "og:description"?: string;
}

/**
 * Single item in bundled URL previews in MSC4095
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
export interface BundledUrlPreview extends BundledUrlPreviewOpenGraph {
    "matrix:matched_url": string;
    "matrix:image:encrypted"?: EncryptedFile;
}

/**
 * Single item in bundled URL previews, as sent before MSC4095 was accepted.
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
export interface UnstableBundledUrlPreviewSingle extends BundledUrlPreviewOpenGraph {
    "matched_url": string;
    "beeper:image:encryption"?: EncryptedFile;
}

export type RoomMessageEventContent = SdkRoomMessageEventContent & BundledUrlPreviews & UnstableBundledUrlPreviews;
