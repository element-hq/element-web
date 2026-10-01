/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * A tuple of an emoji and string representing a user's MSC4426 status.
 * The emoji should be a single grapheme cluster.
 */
export interface UserStatus {
    /**
     * The emoji representing the user's status. This must be a single grapheme cluster.
     */
    emoji: string;
    /**
     * The text representing the user's status.
     */
    text: string;
}

/**
 * MSC4426 product guideline: custom status text is intended to be around 30 characters.
 * Element Web treats this as 30 Unicode grapheme clusters.
 */
const MAX_USER_STATUS_GRAPHEMES = 30;

/**
 * MSC4426 protocol maximum for the `text` field, in UTF-8 bytes.
 */
const MAX_USER_STATUS_TEXT_BYTES = 256;

const graphemeSegmenter = new Intl.Segmenter();
const textEncoder = new TextEncoder();

/**
 * Limits composed status text to the UI grapheme guideline without exceeding the
 * protocol UTF-8 byte cap. Truncation always keeps complete grapheme clusters.
 */
export function limitUserStatusInputText(text: string): string {
    let graphemes = 0;
    let usedBytes = 0;
    let end = 0;
    for (const { segment, index } of graphemeSegmenter.segment(text)) {
        const nextBytes = usedBytes + textEncoder.encode(segment).length;
        if (graphemes === MAX_USER_STATUS_GRAPHEMES || nextBytes > MAX_USER_STATUS_TEXT_BYTES) {
            return text.slice(0, end);
        }
        graphemes++;
        usedBytes = nextBytes;
        end = index + segment.length;
    }
    return text;
}
