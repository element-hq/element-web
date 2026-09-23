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
 * A real call through the real Element Call, against a real MatrixRTC backend (Synapse + LiveKit +
 * lk-jwt-service, started by the `matrixRTC` worker option). Two users, two browser contexts, media
 * flowing both ways.
 *
 * Element Call is the copy the build under test ships, embedded as a widget: the `widgets/element-call/`
 * deployment webpack copies out of `@element-hq/element-call-embedded`. Everything else about the widget
 * transport (call parameters, persistence, PiP, room switching) is covered against a stubbed widget page
 * in `element-call.spec.ts`; this spec exists for the one thing a stub cannot show, namely that media
 * arrives.
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

/** The Element Call widget, wherever Element Web currently keeps it (docked or PiP). */
function callFrame(page: Page): FrameLocator {
    return page.frameLocator('iframe[title="Element Call"]');
}

test.describe("Element Call full call", () => {
    test(
        "two users hold a call through the Element Call widget",
        { tag: ["@no-firefox", "@no-webkit"] },
        async ({ page, app, user, homeserver, browser, config }) => {
            // Two Element Web sessions plus a real media connection: well beyond the default budget
            test.setTimeout(180_000);
            await settleNewSession(page);

            // Bob: a second logged-in Element Web in its own browser context, built from the same pieces as
            // the `user` fixture.
            const bob = await homeserver.registerUser("bob", "password", "Bob");
            const bobContext = await browser.newContext({
                baseURL: new URL(page.url()).origin,
                permissions: ["microphone", "camera"],
            });
            const bobPage = await bobContext.newPage();
            await routeConfigJson(bobContext, homeserver.baseUrl, config);
            await populateLocalStorageWithCredentials(bobPage, bob);

            // A plain, unencrypted room with both in it. Element Web's own room creation lets everyone send
            // call membership events; the raw API keeps the default of 50, which would leave Bob unable to join.
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
            await expect(callFrame(page).getByTestId("lobby_joinCall")).toBeVisible({ timeout: 60_000 });
            await callFrame(page).getByTestId("lobby_joinCall").click();
            await expect(callFrame(page).getByTestId("videoTile")).toHaveCount(1, { timeout: 30_000 });

            // Bob sees the call appear in the room header and joins from the lobby
            await bobPage.getByTestId("join-call-button").click();
            await expect(callFrame(bobPage).getByTestId("lobby_joinCall")).toBeVisible({ timeout: 60_000 });
            await callFrame(bobPage).getByTestId("lobby_joinCall").click();

            // Both see two tiles carrying media
            for (const p of [page, bobPage]) {
                await expect(callFrame(p).getByTestId("videoTile")).toHaveCount(2, { timeout: 30_000 });
                await expect(callFrame(p).getByText("Waiting for media...")).toHaveCount(0, { timeout: 15_000 });
                await expect(callFrame(p).locator("video").filter({ visible: true })).toHaveCount(2, {
                    timeout: 15_000,
                });
            }

            // Bob leaves; Alice sees him go
            await callFrame(bobPage).getByTestId("incall_leave").click();
            await expect(callFrame(page).getByTestId("videoTile")).toHaveCount(1, { timeout: 30_000 });

            // Alice leaves; the room view is back and nothing is left to join
            await callFrame(page).getByTestId("incall_leave").click();
            await expect(page.locator(".mx_BasicMessageComposer")).toBeVisible({ timeout: 30_000 });
            await expect(page.getByTestId("join-call-button")).not.toBeVisible();

            await bobContext.close();
        },
    );
});
