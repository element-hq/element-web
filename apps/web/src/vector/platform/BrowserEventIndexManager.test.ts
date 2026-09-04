/*
Copyright 2026 inblock.io
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import "fake-indexeddb/auto";

import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { Direction } from "matrix-js-sdk/src/matrix";

import { mockPlatformPeg } from "../../../test/test-utils";
import SettingsStore from "../../settings/SettingsStore";
import {
    BrowserEventIndexManager,
    decryptJson,
    deriveDek,
    encryptJson,
    eventHasFile,
    extractSearchText,
    isBrowserEventIndexEnabled,
    isWebEventIndexSupported,
    replacedEventId,
    tokenize,
    effectiveEventForIndex,
} from "./BrowserEventIndexManager";

const SEARCH_DEFAULTS = {
    before_limit: 0,
    after_limit: 0,
    order_by_recency: true,
    limit: 10,
};

function msg(id: string, body: string, extra: Record<string, unknown> = {}): any {
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
                "body": "* new",
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

describe("BrowserEventIndex support gating", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("is unsupported without IndexedDB", () => {
        vi.stubGlobal("indexedDB", undefined);
        expect(isWebEventIndexSupported()).toBe(false);
        expect(isBrowserEventIndexEnabled()).toBe(false);
    });

    it("is supported, and follows the labs flag, when the platform has the primitives", () => {
        expect(isWebEventIndexSupported()).toBe(true);

        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        expect(isBrowserEventIndexEnabled()).toBe(true);

        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        expect(isBrowserEventIndexEnabled()).toBe(false);
    });

    it("treats a throwing SettingsStore as disabled rather than propagating", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation(() => {
            throw new Error("settings not ready");
        });
        expect(isBrowserEventIndexEnabled()).toBe(false);
    });

    it("reports supportsEventIndexing from the same gate", async () => {
        const manager = new BrowserEventIndexManager();
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        expect(await manager.supportsEventIndexing()).toBe(true);
    });
});

describe("BrowserEventIndexManager (IndexedDB backed)", () => {
    const DEVICE = "DEVICE1";
    let manager: BrowserEventIndexManager;
    let pickleKey: string | null;
    let userCounter = 0;
    let userId: string;

    const search = (term: string, overrides: Record<string, unknown> = {}): any =>
        ({ search_term: term, ...SEARCH_DEFAULTS, ...overrides }) as any;

    beforeEach(() => {
        // A fresh factory per test so leftover ciphertext cannot leak between them.
        vi.stubGlobal("indexedDB", new IDBFactory());
        pickleKey = "unit-test-pickle-key";
        userId = `@user${++userCounter}:example.org`;
        mockPlatformPeg({
            getPickleKey: vi.fn().mockImplementation(async () => pickleKey),
        });
        manager = new BrowserEventIndexManager();
    });

    afterEach(async () => {
        await manager.closeEventIndex();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("reloads events, checkpoints and the user version from IndexedDB", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$p", "persisted needle"), { displayname: "Alice" });
        const cp = { roomId: "!room:example.org", token: "tok", direction: Direction.Backward };
        await manager.addCrawlerCheckpoint(cp);
        await manager.setUserVersion(1);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            const hit = await reloaded.searchEventIndex(search("needle"));
            expect(hit.count).toBe(1);
            expect(hit.results![0].result.event_id).toEqual("$p");
            expect(await reloaded.loadCheckpoints()).toEqual([cp]);
            expect(await reloaded.getUserVersion()).toBe(1);
            // Size is measured in ciphertext once records have been written.
            expect((await reloaded.getStats()).size).toBeGreaterThan(0);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("wipes leftover ciphertext it can no longer decrypt", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$w", "old-key secret"), {});
        await manager.setUserVersion(1);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        // A new session with a different pickle key derives a different DEK.
        pickleKey = "a-completely-different-pickle-key";
        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect(await reloaded.isEventIndexEmpty()).toBe(true);
            expect(await reloaded.getUserVersion()).toBe(0);
            expect((await reloaded.searchEventIndex(search("secret"))).count).toBe(0);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("deleteEventIndex drops the stored records, not just the memory index", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$d", "doomed"), {});
        await manager.addCrawlerCheckpoint({ roomId: "!room:example.org", token: "t", direction: Direction.Backward });
        await manager.commitLiveEvents();
        await manager.deleteEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect(await reloaded.isEventIndexEmpty()).toBe(true);
            expect(await reloaded.loadCheckpoints()).toEqual([]);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("deleteEvent removes the event once, and reports whether it existed", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$x", "removable"), {});
        await manager.commitLiveEvents();

        expect(await manager.deleteEvent("$x")).toBe(true);
        expect(await manager.deleteEvent("$x")).toBe(false);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect((await reloaded.searchEventIndex(search("removable"))).count).toBe(0);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("removeCrawlerCheckpoint deletes the persisted checkpoint", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const cp = { roomId: "!room:example.org", token: "tok", direction: Direction.Backward };
        await manager.addCrawlerCheckpoint(cp);
        // Adding the same checkpoint twice must not duplicate it.
        await manager.addCrawlerCheckpoint(cp);
        expect(await manager.loadCheckpoints()).toEqual([cp]);
        await manager.removeCrawlerCheckpoint(cp);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect(await reloaded.loadCheckpoints()).toEqual([]);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("does not persist anything when there is no pickle key", async () => {
        pickleKey = null;
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$e", "ephemeral wording"), {});
        await manager.commitLiveEvents();
        // Memory-only sessions have no ciphertext to measure, so stats fall back to an estimate.
        expect((await manager.getStats()).size).toBeGreaterThan(0);
        expect((await manager.searchEventIndex(search("ephemeral"))).count).toBe(1);
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect(await reloaded.isEventIndexEmpty()).toBe(true);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("degrades to memory-only when IndexedDB is unavailable", async () => {
        vi.stubGlobal("indexedDB", undefined);
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$m", "memory only"), {});
        await manager.commitLiveEvents();
        expect((await manager.searchEventIndex(search("memory"))).count).toBe(1);
        // The wipe path must not throw when there is no database to wipe.
        await manager.deleteEventIndex();
        expect(await manager.isEventIndexEmpty()).toBe(true);
    });

    it("returns surrounding events and profiles as search context", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$1", "before", { origin_server_ts: 1 }), { displayname: "Alice" });
        await manager.addEventToIndex(msg("$2", "context needle", { origin_server_ts: 2 }), { displayname: "Alice" });
        await manager.addEventToIndex(msg("$3", "after", { origin_server_ts: 3 }), { displayname: "Alice" });

        const result = await manager.searchEventIndex(search("needle", { before_limit: 1, after_limit: 1 }));
        expect(result.count).toBe(1);
        const context = result.results![0].context;
        expect(context.events_before.map((e) => e.event_id)).toEqual(["$1"]);
        expect(context.events_after.map((e) => e.event_id)).toEqual(["$3"]);
        expect(context.profile_info["@alice:example.org"]).toEqual({ displayname: "Alice" });
    });

    it("lists file events newest-first, and forwards from a given event", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const file = (id: string, ts: number): any =>
            msg(id, "file", { origin_server_ts: ts, content: { url: "mxc://s/a", msgtype: "m.file" } });
        await manager.addEventToIndex(file("$f1", 1), {});
        await manager.addEventToIndex(file("$f2", 2), {});
        await manager.addEventToIndex(msg("$plain", "not a file", { origin_server_ts: 3 }), {});

        const backwards = await manager.loadFileEvents({ roomId: "!room:example.org", limit: 10 });
        expect(backwards.map((e) => e.event.event_id)).toEqual(["$f2", "$f1"]);

        const forwards = await manager.loadFileEvents({
            roomId: "!room:example.org",
            limit: 10,
            direction: "f",
        });
        expect(forwards.map((e) => e.event.event_id)).toEqual(["$f1", "$f2"]);

        const after = await manager.loadFileEvents({
            roomId: "!room:example.org",
            limit: 10,
            direction: "f",
            fromEvent: "$f1",
        });
        expect(after.map((e) => e.event.event_id)).toEqual(["$f2"]);

        expect(await manager.loadFileEvents({ roomId: "!unknown:example.org", limit: 10 })).toEqual([]);
    });

    it("returns an empty result for an empty term, and once closed", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$s", "something"), {});
        expect((await manager.searchEventIndex(search(""))).count).toBe(0);

        await manager.closeEventIndex();
        expect((await manager.searchEventIndex(search("something"))).count).toBe(0);
        expect(await manager.addHistoricEvents([{ event: msg("$h", "historic"), profile: {} }], null, null)).toBe(
            false,
        );
    });

    it("strips a null state_key from results", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$sk", "stateless", { state_key: null }), {});
        const result = await manager.searchEventIndex(search("stateless"));
        expect(result.results![0].result).not.toHaveProperty("state_key");
    });

    it("addHistoricEvents refreshes a stale body and rotates the crawler checkpoints", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const stale = msg("$hist", "stale wording");
        expect(await manager.addHistoricEvents([{ event: stale, profile: {} }], null, null)).toBe(false);

        const older = { roomId: "!room:example.org", token: "old", direction: Direction.Backward };
        const newer = { roomId: "!room:example.org", token: "new", direction: Direction.Backward };
        await manager.addCrawlerCheckpoint(older);

        const refreshed = msg("$hist", "fresh wording");
        expect(await manager.addHistoricEvents([{ event: refreshed, profile: {} }], newer, older)).toBe(false);

        expect(await manager.loadCheckpoints()).toEqual([newer]);
        expect((await manager.searchEventIndex(search("stale"))).count).toBe(0);
        expect((await manager.searchEventIndex(search("fresh"))).count).toBe(1);
    });

    it("keeps the edited body when the original arrives afterwards", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(
            msg("$edit", "* edited wording", {
                origin_server_ts: 2000,
                content: {
                    "m.new_content": { body: "edited wording", msgtype: "m.text" },
                    "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
                },
            }),
            {},
        );
        // The original turns up later, via both the live and the historic path.
        await manager.addEventToIndex(msg("$orig", "original wording"), {});
        await manager.addHistoricEvents([{ event: msg("$orig", "original wording"), profile: {} }], null, null);

        expect((await manager.searchEventIndex(search("original"))).count).toBe(0);
        expect((await manager.searchEventIndex(search("edited"))).count).toBe(1);
    });
});
