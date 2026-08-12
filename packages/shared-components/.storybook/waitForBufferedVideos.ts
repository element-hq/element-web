/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, waitFor } from "storybook/test";

/**
 * Wait for every `<video>` rendered by a story to finish buffering.
 *
 * The native video controls draw a buffered-progress bar, so a screenshot taken while the clip is
 * still downloading is not reproducible: the bar is a different width on every run. The browser stops
 * buffering once it has enough data and suspends the download (`NETWORK_IDLE`), and that settled state
 * is stable, so waiting for it pins the bar to a deterministic width.
 */
export async function waitForBufferedVideos(canvasElement: HTMLElement): Promise<void> {
    const videos = Array.from(canvasElement.querySelectorAll("video"));

    await Promise.all(
        videos.map((video) =>
            waitFor(
                () => {
                    expect(video.readyState).toBe(video.HAVE_ENOUGH_DATA);
                    expect(video.networkState).toBe(video.NETWORK_IDLE);
                },
                { timeout: 10000 },
            ),
        ),
    );
}
