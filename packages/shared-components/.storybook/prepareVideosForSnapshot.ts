/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, waitFor } from "storybook/test";

/**
 * A Storybook `play` helper that waits for every `<video>` in a story to be buffered end to end.
 *
 * The native video controls draw a buffered-progress bar, so a snapshot taken while the browser is
 * still fetching the clip is not reproducible: the bar is a different width on every run. Stories that
 * use this must point at a clip small enough for the browser to buffer in one go — see
 * `videoPreviewDemo.webm` — otherwise the browser suspends the download part-way and this never
 * settles.
 */
export async function prepareVideosForSnapshot(canvasElement: HTMLElement): Promise<void> {
    const videos = Array.from(canvasElement.querySelectorAll("video"));

    await Promise.all(
        videos.map((video) =>
            waitFor(() => {
                expect(video.readyState).toBe(video.HAVE_ENOUGH_DATA);
                expect(video.buffered.length).toBe(1);
                expect(video.buffered.end(0)).toBeGreaterThanOrEqual(video.duration);
            }),
        ),
    );
}
