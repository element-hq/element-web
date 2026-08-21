/*
Copyright 2026 inblock.io
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { Direction } from "matrix-js-sdk/src/matrix";

import { mockPlatformPeg } from "../../../test/test-utils";
import {
    BrowserEventIndexManager,
    decryptJson,
    deriveDek,
    encryptJson,
    eventHasFile,
    extractSearchText,
    isBrowserEventIndexEnabled,
    replacedEventId,
    tokenize,
    effectiveEventForIndex,
} from "./BrowserEventIndexManager";

function msg(
    id: string,
    body: string,
    extra: Record<string, unknown> = {},
): any {
    return {
        event_id: id,
        room_id: "!room:example.org",
        sender: "@alice:example.org",
        type: "m.room.message",
        origin_server_ts: extra.origin_server_ts ?? 1000,
        content: { body, msgtype: "m.text", ...(extra.content as object) },
        ...extra,
    };
}

describe("BrowserEventIndex helpers", () => {
    it("tokenizes case-insensitively, folds accents, and drops punctuation", () => {
        expect(tokenize("Hello, WORLD! 42")).toEqual(["hello", "world", "42"]);
        expect(tokenize("Café Zürich")).toEqual(["cafe", "zurich"]);
        expect(tokenize("")).toEqual([]);
    });

    it("extracts body / name / topic, filename, and prefers m.new_content", () => {
        expect(extractSearchText(msg("$1", "plain"))).toEqual("plain");
        expect(
            extractSearchText(
                msg("$f", "image.jpg", { content: { filename: "quarterly-report.pdf", msgtype: "m.file" } }),
            ),
        ).toContain("quarterly-report.pdf");
        expect(
            extractSearchText({
                type: "m.room.name",
                content: { name: "Lobby" },
            } as any),
        ).toEqual("Lobby");
        expect(
            extractSearchText({
                type: "m.room.topic",
                content: { topic: "About us" },
            } as any),
        ).toEqual("About us");
        expect(
            extractSearchText(
                msg("$e", "old", {
                    content: { "m.new_content": { body: "new body", msgtype: "m.text" } },
                }),
            ),
        ).toContain("new body");
    });

    it("detects m.replace and rewrites the stored event id to the original", () => {
        const edit = msg("$edit", "ignored", {
            content: {
                body: "* new",
                "m.new_content": { body: "new", msgtype: "m.text" },
                "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
            },
        });
        expect(replacedEventId(edit)).toEqual("$orig");
        expect(effectiveEventForIndex(edit).event_id).toEqual("$orig");
        expect(effectiveEventForIndex(edit).content.body).toEqual("new");
        expect(replacedEventId(msg("$1", "plain"))).toBeNull();
    });

    it("flags file events by mxc URL only", () => {
        expect(eventHasFile(msg("$1", "hi"))).toBe(false);
        expect(eventHasFile(msg("$2", "file", { content: { url: "mxc://s/a" } }))).toBe(true);
        expect(eventHasFile(msg("$3", "http", { content: { url: "https://x" } }))).toBe(false);
    });

    it("encrypts to non-plaintext and decrypts with the same key only", async () => {
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const dek = await deriveDek("pickle-secret-one", salt, "@a:hs", "DEVICE");
        const blob = await encryptJson(dek, { body: "secret message" }, "@a:hs|$e");
        expect(blob.ct.includes("secret")).toBe(false);
        expect(atob(blob.ct).includes("secret")).toBe(false);
        const out = await decryptJson<{ body: string }>(dek, blob, "@a:hs|$e");
        expect(out.body).toEqual("secret message");

        const other = await deriveDek("pickle-secret-two", salt, "@a:hs", "DEVICE");
        await expect(decryptJson(other, blob, "@a:hs|$e")).rejects.toThrow();
        await expect(decryptJson(dek, blob, "wrong-aad")).rejects.toThrow();
    });
});

describe("isBrowserEventIndexEnabled", () => {
    it("is false when the labs flag is off", () => {
        expect(isBrowserEventIndexEnabled()).toBe(false);
    });
});

describe("BrowserEventIndexManager", () => {
    let manager: BrowserEventIndexManager;

    beforeEach(() => {
        mockPlatformPeg({
            getPickleKey: vi.fn().mockResolvedValue("unit-test-pickle-key"),
        });
        manager = new BrowserEventIndexManager();
    });

    afterEach(async () => {
        await manager.deleteEventIndex();
        vi.restoreAllMocks();
    });

    it("prefixes every token of length >= 2", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$p", "invoice payment received"), {});
        const hit = await manager.searchEventIndex({
            search_term: "inv pay",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(hit.count).toBe(1);
        expect(hit.results![0].result.event_id).toEqual("$p");
    });

    it("folds accents so cafe matches café", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$c", "Meet at Café Zürich"), {});
        const hit = await manager.searchEventIndex({
            search_term: "cafe zurich",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(hit.count).toBe(1);
    });

    it("finds a file by filename even when body is just the short name", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(
            msg("$file", "image.jpg", {
                content: { filename: "quarterly-report.pdf", url: "mxc://s/a", msgtype: "m.file" },
            }),
            {},
        );
        const hit = await manager.searchEventIndex({
            search_term: "quarterly-report",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(hit.count).toBe(1);
    });

    it("falls back to mid-word substring when token AND misses (query length >= 3)", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$s", "please send the invoice"), {});
        const hit = await manager.searchEventIndex({
            search_term: "oice",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(hit.count).toBe(1);
        const tooShort = await manager.searchEventIndex({
            search_term: "ce",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(tooShort.count).toBe(0);
    });

    it("indexes a live event and finds it via the stock search shape", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$a", "unique token zebra-42"), { displayname: "Alice" });
        await manager.commitLiveEvents();

        const result = await manager.searchEventIndex({
            search_term: "zebra-42",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(result.count).toBe(1);
        expect(result.results![0].result.event_id).toEqual("$a");
        expect((result.results![0].result.content as any).body).toEqual("unique token zebra-42");
        expect(result.highlights).toContain("zebra");
        expect(result.highlights).toContain("42");
    });

    it("search after m.replace finds the new body and not the old one", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$orig", "old wording xyz"), {});
        await manager.addEventToIndex(
            msg("$edit", "* new wording abc", {
                origin_server_ts: 2000,
                content: {
                    "m.new_content": { body: "new wording abc", msgtype: "m.text" },
                    "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
                },
            }),
            {},
        );

        const oldHit = await manager.searchEventIndex({
            search_term: "xyz",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(oldHit.count).toBe(0);

        const newHit = await manager.searchEventIndex({
            search_term: "abc",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(newHit.count).toBe(1);
        expect(newHit.results![0].result.event_id).toEqual("$orig");
        expect((newHit.results![0].result.content as any).body).toEqual("new wording abc");
    });

    it("addHistoricEvents returns true only when every event was already present", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        const ev = { event: msg("$h", "historic"), profile: {} };
        expect(await manager.addHistoricEvents([ev], null, null)).toBe(false);
        expect(await manager.addHistoricEvents([ev], null, null)).toBe(true);
    });

    it("scopes search to a room and paginates with next_batch", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        const inA = msg("$1", "needle", { origin_server_ts: 1 });
        inA.room_id = "!a:hs";
        const inB = msg("$2", "needle", { origin_server_ts: 2 });
        inB.room_id = "!b:hs";
        await manager.addEventToIndex(inA, {});
        await manager.addEventToIndex(inB, {});

        const roomB = await manager.searchEventIndex({
            search_term: "needle",
            room_id: "!b:hs",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(roomB.count).toBe(1);

        await manager.addEventToIndex(msg("$p1", "page", { origin_server_ts: 10 }), {});
        await manager.addEventToIndex(msg("$p2", "page", { origin_server_ts: 20 }), {});
        const page1 = await manager.searchEventIndex({
            search_term: "page",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 1,
        });
        expect(page1.results).toHaveLength(1);
        expect(page1.next_batch).toBeDefined();
        const page2 = await manager.searchEventIndex({
            search_term: "page",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 1,
            next_batch: page1.next_batch,
        });
        expect(page2.results).toHaveLength(1);
        expect(page2.results![0].result.event_id).not.toEqual(page1.results![0].result.event_id);
    });

    it("stores checkpoints and reports stats", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        expect(await manager.isEventIndexEmpty()).toBe(true);
        await manager.addEventToIndex(msg("$s", "stats"), {});
        const cp = { roomId: "!room:example.org", token: "t1", direction: Direction.Backward };
        await manager.addCrawlerCheckpoint(cp);
        expect(await manager.loadCheckpoints()).toEqual([cp]);
        await manager.removeCrawlerCheckpoint(cp);
        expect(await manager.loadCheckpoints()).toEqual([]);
        expect(await manager.isRoomIndexed("!room:example.org")).toBe(true);
        const stats = await manager.getStats();
        expect(stats.eventCount).toBe(1);
        expect(stats.roomCount).toBe(1);
    });

    it("deleteEventIndex drops in-memory hits", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$gone", "vanishing secret"), {});
        await manager.deleteEventIndex();
        const result = await manager.searchEventIndex({
            search_term: "vanishing",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(result.count).toBe(0);
    });

    it("does not share hits across user ids in the same manager lifecycle", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$a", "alice-only-token"), {});
        await manager.closeEventIndex();
        await manager.initEventIndex("@bob:example.org", "DEVICE2");
        const result = await manager.searchEventIndex({
            search_term: "alice-only-token",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        expect(result.count).toBe(0);
    });

    it("does not persist megolm session keys — only the Seshat event classes", async () => {
        await manager.initEventIndex("@alice:example.org", "DEVICE1");
        await manager.addEventToIndex(msg("$m", "hello"), {});
        const result = await manager.searchEventIndex({
            search_term: "hello",
            before_limit: 0,
            after_limit: 0,
            order_by_recency: true,
            limit: 10,
        });
        const ev = result.results![0].result as any;
        expect(ev.content.session_id).toBeUndefined();
        expect(ev.content.session_key).toBeUndefined();
        expect(JSON.stringify(ev).includes("session_key")).toBe(false);
    });
});
