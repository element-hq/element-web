/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// HEIC/HEIF cannot be decoded by Chromium, so HEIC image messages would otherwise render broken. Element
// deliberately bundles NO HEIC decoder: instead, on desktop platforms whose OS ships a licensed HEIC
// decoder, the Electron main process decodes it for us and exposes `window.electron.decodeHeic` (see
// apps/desktop; macOS uses the Image I/O framework). Decoding is delegated to the platform — the same way
// web browsers and Element's native mobile apps handle HEIC/HEVC — so no HEVC-patented or copyleft decoder
// is shipped. Where the OS cannot decode HEIC (Element Web, or a desktop platform without OS support), HEIC
// simply falls back to a file attachment, unchanged from before this feature.

import { type IContent } from "matrix-js-sdk/src/matrix";

/**
 * Whether an event/content mimetype names HEIC/HEIF — used for routing, not for the decode itself.
 *
 * Also accepts the Apple Uniform Type Identifiers `public.heic`/`public.heif`: some senders (e.g. Beeper,
 * the original report in element-hq/element-web#19531) put the UTI in `info.mimetype` instead of a real
 * mimetype, and those events often carry no file extension for {@link isHeicFilename} to fall back on.
 */
export function isHeicMimeType(mimetype?: string): boolean {
    if (!mimetype) return false;
    const m = mimetype.split(";")[0].trim().toLowerCase();
    return (
        m === "image/heic" ||
        m === "image/heif" ||
        m === "image/heic-sequence" ||
        m === "image/heif-sequence" ||
        m === "public.heic" ||
        m === "public.heif"
    );
}

/** Whether a filename has a HEIC/HEIF extension — a fallback for senders that omit/mangle the mimetype. */
export function isHeicFilename(filename?: string): boolean {
    if (!filename) return false;
    return /\.(heic|heif)$/i.test(filename.trim());
}

/**
 * Whether a message's media content is HEIC/HEIF, by advertised mimetype OR filename extension. HEIC is
 * routinely sent as an `m.file` (or with a missing/incorrect mimetype) by clients that can't thumbnail it,
 * so routing must not rely on `msgtype` or the mimetype alone.
 */
export function isHeicContent(content?: IContent): boolean {
    if (!content) return false;
    return isHeicMimeType(content.info?.mimetype) || isHeicFilename(content.filename ?? content.body);
}

/** Whether this platform can decode HEIC — i.e. the desktop main process exposed an OS-backed decoder. */
export function canDecodeHeic(): boolean {
    return typeof window.electron?.decodeHeic === "function";
}

/**
 * Whether HEIC/HEIF content should be rendered as a (decoded) image here: true only when the content is
 * HEIC AND this platform has an OS decoder. Callers use this to route HEIC to the image renderer only where
 * we can actually decode it; elsewhere it stays a file attachment. See {@link canDecodeHeic}.
 */
export function isDecodableHeicContent(content?: IContent): boolean {
    return isHeicContent(content) && canDecodeHeic();
}

// A pathological/huge HEIC (or a hung native decoder) could otherwise decode forever, leaving the caller
// stuck on a spinner. This bound makes the decode reject so callers can fall back / show an error. The
// desktop main process applies its own backstop of the same duration (HEIC_HELPER_TIMEOUT_MS in
// apps/desktop/src/heic.ts) — keep the two in sync.
const HEIC_DECODE_TIMEOUT_MS = 30_000;

/**
 * Reject if `p` doesn't settle within {@link HEIC_DECODE_TIMEOUT_MS}. Note this is only about UI recovery:
 * the underlying out-of-process native decoder may keep running in the background on timeout — we just stop
 * waiting on it.
 */
function withDecodeTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`HEIC decode timed out after ${HEIC_DECODE_TIMEOUT_MS}ms`)),
            HEIC_DECODE_TIMEOUT_MS,
        );
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Decode a HEIC/HEIF blob to a JPEG blob via the OS decoder exposed by Element Desktop's main process
 * (`window.electron.decodeHeic`). Only call where {@link canDecodeHeic} is true — callers gate rendering on
 * {@link isDecodableHeicContent} — otherwise this rejects, as no decoder is bundled.
 */
export async function decodeHeicToJpeg(blob: Blob): Promise<Blob> {
    if (!window.electron?.decodeHeic) {
        throw new Error("No HEIC decoder available on this platform");
    }
    const input = new Uint8Array(await blob.arrayBuffer());
    const jpeg = await withDecodeTimeout(window.electron.decodeHeic(input));
    // Copy into a fresh ArrayBuffer-backed view: satisfies BlobPart typing and avoids aliasing a pooled
    // Node Buffer that may arrive over IPC.
    return new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" });
}
