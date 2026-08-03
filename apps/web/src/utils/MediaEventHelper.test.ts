/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { MediaEventHelper } from "./MediaEventHelper.ts";

describe("MediaEventHelper", () => {
    it("should set the mime type on the blob based on the event metadata", async () => {
        stubClient();

        const event = new MatrixEvent({
            type: "m.room.message",
            content: {
                msgtype: "m.image",
                body: "image.png",
                info: {
                    mimetype: "image/png",
                    size: 1234,
                    w: 100,
                    h: 100,
                    thumbnail_info: {
                        mimetype: "image/png",
                    },
                    thumbnail_url: "mxc://matrix.org/thumbnail",
                },
                url: "mxc://matrix.org/abcdef",
            },
        });
        const helper = new MediaEventHelper(event);

        const blob = await helper.thumbnailBlob.value;
        expect(blob?.type).toBe(event.getContent().info.thumbnail_info?.mimetype);
    });
});
