/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type IContent } from "matrix-js-sdk/src/matrix";

import { type BundledUrlPreview, type UnstableBundledUrlPreviewSingle } from "../../@types/url-preview";

/**
 * The event content field holding bundled URL previews.
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4095
 */
export const BUNDLED_URL_PREVIEWS = "m.url_previews";

/**
 * The field bundled URL previews were sent in before MSC4095 was accepted.
 * No longer sent, but still read so that older messages keep their previews.
 */
export const UNSTABLE_BUNDLED_URL_PREVIEWS = "com.beeper.linkpreviews";

/**
 * Convert one bundle entry to the stable field names.
 * @param entry An entry in either the stable or the unstable format.
 * @returns The entry, or undefined if it does not name the URL it previews.
 */
function toStableEntry(entry: unknown): BundledUrlPreview | undefined {
    if (typeof entry !== "object" || entry === null) return undefined;

    const {
        "matched_url": unstableMatchedUrl,
        "beeper:image:encryption": unstableEncryptedImage,
        ...rest
    } = entry as Partial<BundledUrlPreview & UnstableBundledUrlPreviewSingle>;

    const matchedUrl = rest["matrix:matched_url"] ?? unstableMatchedUrl;
    if (typeof matchedUrl !== "string") return undefined;

    const stableEntry: BundledUrlPreview = { ...rest, "matrix:matched_url": matchedUrl };
    // Only set when there is one, as an entry with nothing but a matched URL has its own meaning.
    const encryptedImage = rest["matrix:image:encrypted"] ?? unstableEncryptedImage;
    if (encryptedImage !== undefined) stableEntry["matrix:image:encrypted"] = encryptedImage;
    return stableEntry;
}

/**
 * Read the bundled URL previews (MSC4095) from the content of an event.
 *
 * Both the stable format and the unstable format that came before it are accepted. The stable
 * field is used when an event carries both. Entries are returned with the stable field names
 * whichever format they were sent in, and entries that do not name a URL are left out.
 *
 * @param content The event content.
 * @returns The bundled previews, or undefined if the event has no bundle. An empty array means
 *          the sender asked for no previews to be shown.
 */
export function getBundledUrlPreviews(content: IContent): BundledUrlPreview[] | undefined {
    const stable = content[BUNDLED_URL_PREVIEWS];
    const bundle = Array.isArray(stable) ? stable : content[UNSTABLE_BUNDLED_URL_PREVIEWS];
    if (!Array.isArray(bundle)) return undefined;

    return bundle.map(toStableEntry).filter((entry) => entry !== undefined);
}
