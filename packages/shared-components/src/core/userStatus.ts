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
export const MAX_USER_STATUS_TEXT_BYTES = 256;

const graphemeSegmenter = new Intl.Segmenter();
const textEncoder = new TextEncoder();

function truncateToGraphemes(text: string, maxGraphemes: number): { text: string; truncated: boolean } {
    let count = 0;
    for (const { index } of graphemeSegmenter.segment(text)) {
        if (count === maxGraphemes) {
            return { text: text.slice(0, index), truncated: true };
        }
        count++;
    }
    return { text, truncated: false };
}

function truncateToUtf8BytesOnGraphemeBoundary(text: string, maxBytes: number): string {
    if (textEncoder.encode(text).length <= maxBytes) {
        return text;
    }

    let end = 0;
    let usedBytes = 0;
    for (const { segment, index } of graphemeSegmenter.segment(text)) {
        const nextBytes = usedBytes + textEncoder.encode(segment).length;
        if (nextBytes > maxBytes) {
            return text.slice(0, end);
        }
        usedBytes = nextBytes;
        end = index + segment.length;
    }
    return text;
}

/**
 * Limits composed status text to the UI grapheme guideline without exceeding the
 * protocol UTF-8 byte cap. Truncation always keeps complete grapheme clusters.
 */
export function limitUserStatusInputText(text: string): string {
    const { text: graphemeLimited } = truncateToGraphemes(text, MAX_USER_STATUS_GRAPHEMES);
    return truncateToUtf8BytesOnGraphemeBoundary(graphemeLimited, MAX_USER_STATUS_TEXT_BYTES);
}

/**
 * Formats received status text for display: at most 30 graphemes, with an ellipsis
 * appended when the original value was longer. An exact-length value is unchanged.
 */
export function formatUserStatusTextForDisplay(text: string): string {
    const { text: limited, truncated } = truncateToGraphemes(text, MAX_USER_STATUS_GRAPHEMES);
    return truncated ? `${limited}…` : limited;
}
