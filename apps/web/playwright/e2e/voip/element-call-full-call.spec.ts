/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FrameLocator, type Page } from "@playwright/test";
import {
    closeReleaseAnnouncementIfExists,
    populateLocalStorageWithCredentials,
    rejectToast,
    routeConfigJson,
} from "@element-hq/element-web-playwright-common";

import { test, expect } from "../../element-web-test";

/**
 * A real call between two users through the real Element Call, against a real MatrixRTC backend (Synapse +
 * LiveKit + lk-jwt-service, started by the `matrixRTC` worker option). Two browser contexts, media flowing
 * both ways.
 *
 * Run once per embedding: the widget in an iframe (the `widgets/element-call/` deployment webpack copies
 * out of `@element-hq/element-call-embedded`) and, behind `feature_element_call_react`, the in-process
 * React component (`@element-hq/element-call-component`). Both are the copy the build under test ships and
 * both end up talking to the same SFU, so this is where the two are held to the same standard. Everything
 * else about either embedding (call parameters, persistence, PiP, room switching) is covered against
 * stand-ins in `element-call.spec.ts`; this spec exists for the one thing a stand-in cannot show, namely
 * that media arrives.
 */
test.use({
    matrixRTC: true,
    displayName: "Alice",
    // The Chrome project only asks for the microphone; the fake devices come from its launch args.
    permissions: ["microphone", "camera"],
});

test.skip(({ homeserverType }) => homeserverType !== "synapse", "Needs Synapse's matrix_rtc configuration");

/** Dismisses what a freshly logged-in Element Web shows before the room is usable. */
async function settleNewSession(page: Page): Promise<void> {
    await rejectToast(page, "Verify this device");
    await rejectToast(page, "Notifications");
    await closeReleaseAnnouncementIfExists(page, "Introducing Sections");
}

for (const embedding of ["widget", "react"] as const) {
    test.describe(`Element Call full call (${embedding})`, () => {
        test.use({
            config: {
                features: {
                    feature_element_call_react: embedding === "react",
                },
            },
        });

        /**
         * Where Element Call's own DOM lives. The widget is an iframe; the component renders straight into
         * the call view. Either way the locators are page-level, because the call lives in the persisted
         * element attached to `<body>` so that it survives navigation.
         */
        const callScope = (page: Page): FrameLocator | Page =>
            embedding === "widget" ? page.frameLocator('iframe[title="Element Call"]') : page;

        test(
            "two users hold a call",
            { tag: ["@no-firefox", "@no-webkit"] },
            async ({ page, app, user, homeserver, browser, config }) => {
                // Two Element Web sessions plus a real media connection: well beyond the default budget
                test.setTimeout(180_000);
                await settleNewSession(page);

                // Bob: a second logged-in Element Web in its own browser context, built from the same pieces
                // as the `user` fixture. `Developer.elementCallMockComponent` is off by default, so on the
                // React embedding both get the real component.
                // The homeserver is worker-scoped and shared with the other embedding's run of this test.
                const bob = await homeserver.registerUser(`bob-${embedding}`, "password", "Bob");
                const bobContext = await browser.newContext({
                    baseURL: new URL(page.url()).origin,
                    permissions: ["microphone", "camera"],
                });
                const bobPage = await bobContext.newPage();
                await routeConfigJson(bobContext, homeserver.baseUrl, config);
                await populateLocalStorageWithCredentials(bobPage, bob);

                // A plain, unencrypted room with both in it. Element Web's own room creation lets everyone
                // send call membership events; the raw API keeps the default of 50, which would leave Bob
                // unable to join.
                const roomId = await app.client.createRoom({
                    name: "Call room",
                    invite: [bob.userId],
                    power_level_content_override: { events: { "org.matrix.msc3401.call.member": 0 } },
                });
                await homeserver.csApi.request("POST", `/v3/join/${roomId}`, bob.accessToken, {});

                // Bob is already looking at the room when the call starts
                await bobPage.goto(`/#/room/${roomId}`);
                await bobPage.waitForSelector(".mx_MatrixChat", { timeout: 30_000 });
                await settleNewSession(bobPage);
                await expect(bobPage.getByRole("heading", { name: "Call room", level: 1 })).toBeVisible();

                // Alice starts the call and joins from Element Call's lobby
                await app.viewRoomById(roomId);
                await expect(page.getByText("Bob joined the room")).toBeVisible();
                await page.getByRole("button", { name: "Video call" }).click();
                await page.getByRole("menuitem", { name: "Element Call" }).click();
                await expect(callScope(page).getByTestId("lobby_joinCall")).toBeVisible({ timeout: 60_000 });
                if (embedding === "react") await expect(page.locator("iframe")).toHaveCount(0);
                await callScope(page).getByTestId("lobby_joinCall").click();
                await expect(callScope(page).getByTestId("videoTile")).toHaveCount(1, { timeout: 30_000 });

                // Bob sees the call appear in the room header and joins from the lobby
                await bobPage.getByTestId("join-call-button").click();
                await expect(callScope(bobPage).getByTestId("lobby_joinCall")).toBeVisible({ timeout: 60_000 });
                await callScope(bobPage).getByTestId("lobby_joinCall").click();

                // Both see two tiles carrying media
                for (const p of [page, bobPage]) {
                    await expect(callScope(p).getByTestId("videoTile")).toHaveCount(2, { timeout: 30_000 });
                    await expect(callScope(p).getByText("Waiting for media...")).toHaveCount(0, { timeout: 15_000 });
                    await expect(callScope(p).locator("video").filter({ visible: true })).toHaveCount(2, {
                        timeout: 15_000,
                    });
                }

                // Bob leaves; Alice sees him go
                await callScope(bobPage).getByTestId("incall_leave").click();
                await expect(callScope(page).getByTestId("videoTile")).toHaveCount(1, { timeout: 30_000 });

                // Alice leaves; the room view is back and nothing is left to join
                await callScope(page).getByTestId("incall_leave").click();
                await expect(page.getByRole("textbox", { name: "Send an unencrypted message…" })).toBeVisible({
                    timeout: 30_000,
                });
                await expect(page.getByTestId("join-call-button")).not.toBeVisible();

                await bobContext.close();
            },
        );
    });
}
