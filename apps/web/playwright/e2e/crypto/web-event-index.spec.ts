/*
Copyright 2026 inblock.io
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { rejectToast } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../element-web-test";

test.describe("Browser EventIndex", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_web_event_index"],
    });

    test("indexes a live encrypted message and finds it via EventIndex.search", async ({
        page,
        app,
    }) => {
        await rejectToast(page, "Verify this device");

        const roomId = await app.client.createRoom({
            name: "search-probe",
            initial_state: [
                {
                    type: "m.room.encryption",
                    state_key: "",
                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                },
            ],
        });
        await app.viewRoomById(roomId);

        const token = `ewsearch-${Date.now()}-alpha`;
        await page.getByRole("textbox", { name: "Send a message…" }).fill(token);
        await page.getByRole("textbox", { name: "Send a message…" }).press("Enter");
        await expect(page.getByText(token)).toBeVisible();

        const hit = await page.evaluate(async (term) => {
            const idx = window.mxEventIndexPeg?.get?.();
            if (!idx) return { hasIndex: false, count: 0 };
            let last = { hasIndex: true, count: 0 };
            for (let i = 0; i < 20; i++) {
                const r = await idx.search({
                    search_term: term,
                    before_limit: 0,
                    after_limit: 0,
                    order_by_recency: true,
                    limit: 10,
                });
                last = { hasIndex: true, count: r?.count ?? 0 };
                if (last.count > 0) return last;
                await new Promise((res) => setTimeout(res, 250));
            }
            return last;
        }, token);

        expect(hit.hasIndex, "EventIndexPeg should be initialised when the labs flag is on").toBe(true);
        expect(hit.count).toBeGreaterThan(0);
    });
});
