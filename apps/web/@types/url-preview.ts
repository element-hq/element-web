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
 * Bundled URL previews in MSC-4095
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
interface UnstableBundledUrlPreviews {
    "com.beeper.linkpreviews"?: UnstableBundledUrlPreviewSingle[];
}

/**
 * Single item in bundled URL previews in MSC4095
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
export interface UnstableBundledUrlPreviewSingle {
    "matched_url": string;
    "beeper:image:encryption"?: EncryptedFile;
    "matrix:image:size"?: number;
    "og:image"?: string;
    "og:url"?: string;
    "og:image:width"?: number;
    "og:image:height"?: number;
    "og:image:type"?: string;
    "og:title"?: string;
    "og:description"?: string;
}

export type RoomMessageEventContent = SdkRoomMessageEventContent & UnstableBundledUrlPreviews;
