/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

/**
 * Unstable, compatibility-safe content metadata used to render several standard
 * Matrix media events as one visual batch in Element. Other Matrix clients ignore
 * unknown content keys and still render the individual m.image events normally.
 */
export const MEDIA_BATCH_CONTENT_KEY = "io.element.media_batch" as const;

export interface MediaBatchMetadata {
    id: string;
    index: number;
    count: number;
}

export type MediaBatchEventContent = {
    [MEDIA_BATCH_CONTENT_KEY]?: MediaBatchMetadata;
};

export function getMediaBatchMetadata(event: MatrixEvent): MediaBatchMetadata | undefined {
    const content = event.getContent<MediaBatchEventContent>();
    const metadata = content[MEDIA_BATCH_CONTENT_KEY];

    if (!metadata || typeof metadata !== "object") return undefined;
    if (typeof metadata.id !== "string" || metadata.id.length === 0) return undefined;
    if (!Number.isInteger(metadata.index) || metadata.index < 0) return undefined;
    if (!Number.isInteger(metadata.count) || metadata.count < 2) return undefined;
    if (metadata.index >= metadata.count) return undefined;

    return metadata;
}

export function isImageMediaBatchEvent(event: MatrixEvent): boolean {
    return (
        event.getType() === EventType.RoomMessage &&
        event.getContent().msgtype === MsgType.Image &&
        getMediaBatchMetadata(event) !== undefined
    );
}

export function sameMediaBatch(firstEvent: MatrixEvent, nextEvent: MatrixEvent): boolean {
    const firstBatch = getMediaBatchMetadata(firstEvent);
    const nextBatch = getMediaBatchMetadata(nextEvent);

    return !!firstBatch && !!nextBatch && firstBatch.id === nextBatch.id && firstBatch.count === nextBatch.count;
}
