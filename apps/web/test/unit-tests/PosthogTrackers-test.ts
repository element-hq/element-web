/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PosthogAnalytics } from "../../src/PosthogAnalytics";
import PosthogTrackers from "../../src/PosthogTrackers";

describe("PosthogTrackers", () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    it("tracks URL Previews", () => {
        jest.spyOn(PosthogAnalytics.instance, "trackEvent");
        const tracker = new PosthogTrackers();
        tracker.trackUrlPreview("$123456", false, [
            {
                title: "A preview",
                image: {
                    imageThumb: "abc",
                    imageFull: "abc",
                },
                link: "a-link",
            },
        ]);
        tracker.trackUrlPreview("$123456", false, [
            {
                title: "A second preview",
                link: "a-link",
            },
        ]);
        // Ignores subsequent calls.
        expect(PosthogAnalytics.instance.trackEvent).toHaveBeenCalledWith({
            eventName: "UrlPreviewRendered",
            previewKind: "LegacyCard",
            hasThumbnail: true,
            previewCount: 1,
            encryptedRoom: false,
        });
        expect(PosthogAnalytics.instance.trackEvent).toHaveBeenCalledTimes(1);
    });
});
