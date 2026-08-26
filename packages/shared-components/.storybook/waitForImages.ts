/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * A Storybook `play` helper that waits for every CSS `background-image` inside the
 * rendered story to finish decoding before the visual-regression snapshot is taken.
 *
 * Components such as `LinkPreview` render their thumbnails as CSS `background-image`s
 * rather than `<img>` elements, so there is no load event for the snapshot machinery
 * to await. A larger image (e.g. the tall test image) can therefore still be decoding
 * when the screenshot is captured, producing a non-deterministic placeholder frame.
 * Decoding the images up-front populates the browser cache so the background paints
 * synchronously on the next frame.
 */
export async function waitForBackgroundImages(root: HTMLElement): Promise<void> {
    const urls = new Set<string>();
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
        const match = /url\(["']?(.+?)["']?\)/.exec(getComputedStyle(el).backgroundImage);
        if (match) urls.add(match[1]);
    }

    await Promise.all(
        [...urls].map(async (src) => {
            const img = new Image();
            img.src = src;
            try {
                await img.decode();
            } catch {
                // Ignore images that fail to decode; the snapshot captures whatever renders.
            }
        }),
    );
}
