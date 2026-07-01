/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";

// Element Web bundles no HEIC decoder: HEIC/HEIF is decoded by the OS on desktop only (see apps/desktop
// and apps/web/src/utils/heic.ts). A HEIC image message must therefore gracefully fall back to a file
// attachment here rather than rendering a broken <img>. This guards that "no regression" contract end to
// end; the native-decode happy path lives in the desktop main process and is covered by the Jest suites.
test.describe("HEIC image messages", () => {
    test.use({
        displayName: "Alice",
    });

    let roomId: string;
    test.beforeEach(async ({ page, app, user }) => {
        roomId = await app.client.createRoom({ name: "My Pictures" });
        await app.viewRoomByName("My Pictures");

        // Wait until configuration is finished
        await expect(
            page
                .locator(".mx_GenericEventListSummary[data-layout='group'] .mx_GenericEventListSummary_summary")
                .getByText(`${user.displayName} created and configured the room.`),
        ).toBeVisible();
    });

    test("gracefully fall back to a file attachment when the platform has no HEIC decoder", async ({ page, app }) => {
        // A HEIC "photo" sent as an m.image, as an iPhone would. The bytes need not be a real HEIC:
        // Element Web never decodes them — it routes on the mimetype/filename and falls back to a file.
        const upload = await app.client.uploadContent(Buffer.from("heic-placeholder-bytes"), {
            name: "IMG_0001.heic",
            type: "image/heic",
        });
        await app.client.sendEvent(roomId, null, "m.room.message" as EventType, {
            msgtype: "m.image" as MsgType,
            body: "IMG_0001.heic",
            filename: "IMG_0001.heic",
            url: upload.content_uri,
            info: { mimetype: "image/heic" },
        });

        // Renders as a downloadable file attachment, not an inline (broken) image.
        await expect(page.locator(".mx_MFileBody").first()).toBeVisible();
        await expect(page.locator(".mx_ImageBody")).toHaveCount(0);
    });
});
