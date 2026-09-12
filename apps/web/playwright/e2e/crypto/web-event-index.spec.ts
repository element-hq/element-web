/*
Copyright 2026 inblock.io

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page } from "@playwright/test";
import { rejectToast, rejectToastIfExists } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../element-web-test";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { logIntoElement, sendMessageInCurrentRoom } from "./utils";

/**
 * The room info panel's search box: the only entry point to searching a single room, and the one
 * the browser EventIndex has to answer because the homeserver cannot search an encrypted room.
 */
const searchBox = (page: Page): Locator => page.locator(".mx_RoomSummaryCard_search").getByRole("searchbox");

/** The panel the results render into, which also carries the "No results" marker. */
const searchResultsPanel = (page: Page): Locator => page.locator(".mx_RoomView_searchResultsPanel");

/**
 * Run one search from the UI. The box is cleared first because the search is driven by the
 * input's change event, so re-typing a value it already holds would fire nothing at all.
 */
async function searchRoomFor(page: Page, term: string): Promise<void> {
    const box = searchBox(page);
    await box.fill("");
    await box.fill(term);
}

/**
 * Search for `term` until `expected` renders among the results.
 *
 * Indexing is asynchronous -- an event is indexed as it arrives from sync, not when it is sent --
 * while a search is a one-shot query rather than a live one, so a search that runs before the
 * event was indexed answers "No results" and stays that way however long the assertion waits.
 * Re-submitting the query is what turns that into a wait for eventual state.
 */
async function searchUntilFound(page: Page, term: string, expected: string): Promise<void> {
    await expect(async () => {
        await searchRoomFor(page, term);
        await expect(searchResultsPanel(page).getByText(expected)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000, intervals: [1000] });
}

/** The display name the user in this file registers under; asserted after the UI login below. */
const DISPLAY_NAME = "Alice";

/** A term no other test, message or piece of chrome can contain. */
const uniqueTerm = (): string => `ewsearch${Date.now()}${Math.floor(Math.random() * 1e6)}`;

const OPENING_MESSAGE = "opening remark far from the needle";
const ADJACENT_MESSAGE = "the message immediately before the needle";

/**
 * Create an encrypted room, put a few messages in it and open the room info panel, where the
 * search box lives.
 *
 * The searchable message is typed into the composer rather than pushed through the client, so at
 * least one event travels the whole live path -- composer, megolm encryption, sync, decryption,
 * index -- before anything is searched for. It is sent last, so the messages around it are
 * already in place and their order cannot race with it.
 *
 * @returns the room, the term to search for, and the body holding it.
 */
async function seedEncryptedRoom(
    page: Page,
    app: ElementAppPage,
): Promise<{ roomId: string; term: string; body: string }> {
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

    // Sent through the client and awaited one after another, so the order they end up in is not
    // in doubt: only the first of these is far enough from the needle to stay out of its context.
    await app.client.sendMessage(roomId, OPENING_MESSAGE);
    await app.client.sendMessage(roomId, ADJACENT_MESSAGE);

    const term = uniqueTerm();
    const body = `needle ${term} in a haystack`;
    await sendMessageInCurrentRoom(page, body);
    await expect(page.getByText(body)).toBeVisible();

    await app.openRoomInfoPanel();
    return { roomId, term, body };
}

test.describe("Browser EventIndex", () => {
    test.use({
        displayName: DISPLAY_NAME,
        labsFlags: ["feature_web_event_index"],
    });

    // `searchUntilFound` is allowed to poll for 30s on its own, which is the whole of the default
    // per-test timeout, so a test that actually had to wait out an indexing delay would fail on the
    // clock rather than on the thing it asserts. Triple the budget so the wait it declares is real.
    test.slow();

    test("finds a message in an encrypted room through the search UI", async ({ page, app, user }) => {
        await rejectToast(page, "Verify this device");
        const { body, term } = await seedEncryptedRoom(page, app);

        await searchUntilFound(page, term, body);

        // The result is the message itself, rendered as a search hit ...
        const results = searchResultsPanel(page);
        await expect(results.getByText(body)).toBeVisible();
        // ... with the one line of context the search asks for either side of it ...
        await expect(results.getByText(ADJACENT_MESSAGE)).toBeVisible();
        // ... and nothing further out, so the panel is showing results rather than the room.
        await expect(results.getByText(OPENING_MESSAGE)).toHaveCount(0);
    });

    test("reports no results for a term that was never sent", async ({ page, app, user }) => {
        await rejectToast(page, "Verify this device");
        const { body, term } = await seedEncryptedRoom(page, app);

        // Establish that the index is live and answering first, or "no results" would be the
        // answer to every query and this test would pass against an index that never started.
        await searchUntilFound(page, term, body);

        await searchRoomFor(page, `${term}nothinghere`);
        await expect(searchResultsPanel(page).getByRole("heading", { name: "No results", exact: true })).toBeVisible();
        await expect(searchResultsPanel(page).getByText(body)).toHaveCount(0);
    });

    /**
     * This test logs in through the UI rather than taking the `user` fixture, and that is load
     * bearing rather than stylistic: the records are encrypted at rest under a key derived from the
     * session's pickle key, so an index in a session that has no pickle key is memory-only by
     * design and *nothing* of it can survive a reload. The `user` fixture writes credentials
     * straight into localStorage with `mx_has_pickle_key: "false"` and never creates one, so on that
     * path this test would assert against a feature that is deliberately switched off. Signing in is
     * what creates the pickle key, so this takes the slower route an actual user takes.
     *
     * Nor does the crawler paper over it: after a reload `EventIndex.addInitialCheckpoints` finds no
     * back-pagination token on the restored live timeline, so it enrols no rooms and the index of a
     * reloaded pickle-key-less session simply stays empty.
     */
    test("still finds an indexed message after a page reload", async ({ page, app, credentials }) => {
        await logIntoElement(page, credentials);
        await expect(page.getByText(`Welcome ${DISPLAY_NAME}`, { exact: true })).toBeVisible();
        // Unlike the fixture's pre-seeded session, a device that has just signed in and has no
        // siblings is not always asked to verify, so this toast may never appear.
        await rejectToastIfExists(page, "Verify this device");

        const { body, term } = await seedEncryptedRoom(page, app);
        await searchUntilFound(page, term, body);

        // The records are read back out of IndexedDB and decrypted on the way up, and the crawler
        // checkpoints come back with them.
        await page.reload();
        await rejectToastIfExists(page, "Verify this device");
        await expect(page.getByText(body)).toBeVisible();

        await app.openRoomInfoPanel();
        await searchUntilFound(page, term, body);
        await expect(searchResultsPanel(page).getByText(body)).toBeVisible();
    });
});
