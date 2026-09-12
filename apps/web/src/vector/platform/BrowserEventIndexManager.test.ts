/*
Copyright 2026 inblock.io

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import "fake-indexeddb/auto";

import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { Direction, encodeBase64 } from "matrix-js-sdk/src/matrix";

import { mockPlatformPeg } from "../../../test/test-utils";
import SettingsStore from "../../settings/SettingsStore";
import {
    BrowserEventIndexManager,
    decryptJson,
    deriveCheckpointMacKey,
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

const EVENTINDEX_DB_NAME = "element-eventindex";

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

/** An m.replace of `origId`, as the live timeline delivers it. */
function edit(id: string, origId: string, newBody: string, ts = 2000): any {
    return msg(id, `* ${newBody}`, {
        origin_server_ts: ts,
        content: {
            "m.new_content": { body: newBody, msgtype: "m.text" },
            "m.relates_to": { rel_type: "m.replace", event_id: origId },
        },
    });
}

function idbPromise<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = (): void => resolve(req.result);
        req.onerror = (): void => reject(req.error);
    });
}

/** Opens a second connection to look at what is really on disk. */
async function withRawDb<T>(fn: (db: IDBDatabase) => Promise<T>, version?: number): Promise<T> {
    const db = await idbPromise(indexedDB.open(EVENTINDEX_DB_NAME, version));
    try {
        return await fn(db);
    } finally {
        db.close();
    }
}

interface RawSnapshot {
    version: number;
    eventIndexNames: string[];
    events: any[];
}

async function inspectRawDb(): Promise<RawSnapshot> {
    return withRawDb(async (db) => {
        const store = db.transaction("events", "readonly").objectStore("events");
        const names: string[] = [];
        for (let i = 0; i < store.indexNames.length; i++) names.push(store.indexNames.item(i)!);
        return { version: db.version, eventIndexNames: names, events: await idbPromise(store.getAll()) };
    });
}

/** Every record of one store, exactly as it sits on disk. */
async function dumpRawStore(name: string): Promise<any[]> {
    return withRawDb((db) => idbPromise(db.transaction(name, "readonly").objectStore(name).getAll()));
}

/**
 * Every record of every store, serialised. This is the string a reader of the IndexedDB file
 * sees, and so the thing a "nothing in the clear" assertion has to be made against.
 */
async function dumpWholeDb(): Promise<string> {
    return withRawDb(async (db) => {
        const names: string[] = [];
        for (let i = 0; i < db.objectStoreNames.length; i++) names.push(db.objectStoreNames.item(i)!);
        const tx = db.transaction(names, "readonly");
        // Every request is issued before anything is awaited: a transaction dies as soon as
        // control returns to the event loop with none outstanding.
        const rows = await Promise.all(names.map((n) => idbPromise(tx.objectStore(n).getAll())));
        return JSON.stringify(Object.fromEntries(names.map((n, i) => [n, rows[i]])));
    });
}

/** Base64 of an HMAC-SHA256 tag: 32 bytes, so 43 base64 characters and one pad. */
const HMAC_B64 = /^[A-Za-z0-9+/]{43}=$/;

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

    it("strips markup from formatted_body without merging adjacent blocks", () => {
        const fromHtml = (formattedBody: string): string =>
            extractSearchText(
                msg("$h", "", { content: { format: "org.matrix.custom.html", formatted_body: formattedBody } }),
            );

        // Tags are dropped, the text they wrap is kept.
        expect(tokenize(fromHtml("<p>hello <b>world</b></p>"))).toEqual(["hello", "world"]);
        expect(tokenize(fromHtml('<a href="https://example.org/">link</a>'))).toEqual(["link"]);

        // Adjacent block elements must stay separate words rather than merging into "foobar".
        expect(tokenize(fromHtml("<p>foo</p><p>bar</p>"))).toEqual(["foo", "bar"]);

        // Entities are decoded, so they are not indexed as "amp" / "lt" / "gt".
        expect(tokenize(fromHtml("Tom &amp; Jerry"))).toEqual(["tom", "jerry"]);
        expect(tokenize(fromHtml("&lt;script&gt;"))).toEqual(["script"]);

        // A decoded entity is a text node of its own, so a separator injected per text node
        // landed in the middle of a word: "AT&T" became "AT & T", and the escaped-ampersand
        // case defeated the decoding below it. Only the substring fallback can see the
        // difference, which is why these assert the text and not its tokens.
        expect(fromHtml("AT&amp;T")).toContain("AT&T");
        expect(fromHtml("&amp;amp;")).toContain("&amp;");
        expect(fromHtml("5 &lt; 6 &amp;&amp; 7 &gt; 2")).toContain("5 < 6 && 7 > 2");
        // ... and decoding stays single-pass: the literal text "&lt;" must not become "<".
        expect(fromHtml("&amp;lt;")).toContain("&lt;");
        expect(fromHtml("&amp;lt;")).not.toContain("<");
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

    it("derives a sign-only checkpoint subkey that is bound to the pickle key, user and device", async () => {
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const key = await deriveCheckpointMacKey("pickle-secret-one", salt, "@a:hs", "DEVICE");
        // Structurally not the DEK: a non-extractable HMAC key that can only sign, so it can
        // neither decrypt the index nor be lifted out and reused as an encryption key.
        expect(key.algorithm.name).toEqual("HMAC");
        expect(key.usages).toEqual(["sign"]);
        expect(key.extractable).toBe(false);

        const tag = async (k: CryptoKey): Promise<string> =>
            encodeBase64(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("tuple"))));

        // Every input that goes into the derivation actually reaches the output.
        const tags = await Promise.all(
            [
                key,
                await deriveCheckpointMacKey("pickle-secret-two", salt, "@a:hs", "DEVICE"),
                await deriveCheckpointMacKey("pickle-secret-one", salt, "@b:hs", "DEVICE"),
                await deriveCheckpointMacKey("pickle-secret-one", salt, "@a:hs", "DEVICE2"),
                await deriveCheckpointMacKey(
                    "pickle-secret-one",
                    crypto.getRandomValues(new Uint8Array(32)),
                    "@a:hs",
                    "DEVICE",
                ),
            ].map(tag),
        );
        expect(new Set(tags).size).toBe(tags.length);
        // ... and it is deterministic, which is what lets a checkpoint address its own record.
        expect(await tag(await deriveCheckpointMacKey("pickle-secret-one", salt, "@a:hs", "DEVICE"))).toEqual(tags[0]);
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
        // The manager enforces the labs gate itself on every path that adds to the index, so
        // the write paths are unreachable without it; see "the labs gate" below for the tests
        // that turn it back off on purpose.
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
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
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
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

    it("degrades to memory-only when IndexedDB refuses to open", async () => {
        // Present but refusing, which is what private browsing and blocked storage look like.
        // An *absent* indexedDB is a different case and never gets this far: it fails the
        // support check, so WebPlatform never builds a manager at all.
        vi.stubGlobal("indexedDB", {
            open: () => {
                const req = { error: new Error("storage is blocked") } as unknown as IDBOpenDBRequest;
                queueMicrotask(() => req.onerror?.(new Event("error")));
                return req;
            },
            deleteDatabase: () => {
                const req = {} as IDBOpenDBRequest;
                queueMicrotask(() => req.onsuccess?.(new Event("success")));
                return req;
            },
        });
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

    it("writes no room id, token or direction into the checkpoints store", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const cp = {
            roomId: "!zqxsecretroom:example.org",
            token: "zqxsecrettoken",
            direction: Direction.Backward,
            fullCrawl: true,
        };
        await manager.addCrawlerCheckpoint(cp);
        await manager.commitLiveEvents();

        const rows = await dumpRawStore("checkpoints");
        expect(rows).toHaveLength(1);
        const [record] = rows;
        // Anything added to this list is metadata handed to whoever can read the IndexedDB
        // file. userId is the `byUser` index and is how a user's records are enumerated.
        expect(Object.keys(record).sort()).toEqual(["blob", "id", "userId"]);
        expect(Object.keys(record.blob).sort()).toEqual(["ct", "iv"]);
        expect(record.userId).toEqual(userId);
        // The primary key is a fixed-width MAC tag, not a `|`-joined tuple, so there is no
        // field in it for a room id, a token or a direction to be read out of.
        expect(record.id).toMatch(HMAC_B64);
        expect(record.id).not.toContain("|");

        const whole = await dumpWholeDb();
        // Positive control: the dump really does reach the records, so the negatives below
        // cannot pass by looking at nothing.
        expect(whole).toContain(userId);
        expect(whole).not.toContain("zqxsecretroom");
        expect(whole).not.toContain("zqxsecrettoken");
        // No column anywhere holds the direction as its value.
        expect(whole).not.toContain(`"${Direction.Backward}"`);
    });

    it("gives unrelated keys to checkpoints that differ only by direction or token", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const roomId = "!same:example.org";
        await manager.addCrawlerCheckpoint({ roomId, token: "tok", direction: Direction.Backward });
        await manager.addCrawlerCheckpoint({ roomId, token: "tok", direction: Direction.Forward });
        await manager.addCrawlerCheckpoint({ roomId, token: "tok2", direction: Direction.Backward });
        await manager.commitLiveEvents();

        const ids = (await dumpRawStore("checkpoints")).map((r) => r.id);
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
        for (const id of ids) expect(id).toMatch(HMAC_B64);
    });

    it("round-trips every checkpoint field through the encrypted store", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const back = {
            roomId: "!alpha:example.org",
            token: "tok-alpha",
            direction: Direction.Backward,
            fullCrawl: true,
        };
        const forward = { roomId: "!beta:example.org", token: "tok-beta", direction: Direction.Forward };
        await manager.addCrawlerCheckpoint(back);
        await manager.addCrawlerCheckpoint(forward);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            // Order follows the (hashed) primary key, so assert on the set, not the sequence.
            const loaded = await reloaded.loadCheckpoints();
            expect(loaded).toHaveLength(2);
            expect(loaded).toEqual(expect.arrayContaining([back, forward]));
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("removes only the addressed checkpoint, not a sibling differing by direction or token", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const roomId = "!sibling:example.org";
        const back = { roomId, token: "tok", direction: Direction.Backward };
        const forward = { roomId, token: "tok", direction: Direction.Forward };
        const later = { roomId, token: "tok2", direction: Direction.Backward };
        for (const cp of [back, forward, later]) await manager.addCrawlerCheckpoint(cp);
        await manager.commitLiveEvents();
        expect(await dumpRawStore("checkpoints")).toHaveLength(3);

        await manager.removeCrawlerCheckpoint(back);
        await manager.commitLiveEvents();
        expect(await manager.loadCheckpoints()).toEqual([forward, later]);
        expect(await dumpRawStore("checkpoints")).toHaveLength(2);
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            const loaded = await reloaded.loadCheckpoints();
            expect(loaded).toHaveLength(2);
            expect(loaded).toEqual(expect.arrayContaining([forward, later]));
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("de-duplicates an equal checkpoint, in memory and on disk", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const cp = { roomId: "!dedupe:example.org", token: "tok", direction: Direction.Backward };
        await manager.addCrawlerCheckpoint(cp);
        // A distinct object with equal fields: de-duplication is by value, not by identity.
        await manager.addCrawlerCheckpoint({ ...cp });
        await manager.commitLiveEvents();

        expect(await manager.loadCheckpoints()).toEqual([cp]);
        // The record key is deterministic, so the second write lands on the first record.
        expect(await dumpRawStore("checkpoints")).toHaveLength(1);
    });

    it("writes nothing but the record key and the ciphertext in the clear", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(
            msg("$plain", "top secret wording", {
                origin_server_ts: 1234567890123,
                content: { url: "mxc://server/attachment", msgtype: "m.file" },
            }),
            { displayname: "Alice" },
        );
        await manager.commitLiveEvents();

        const raw = await inspectRawDb();
        expect(raw.events).toHaveLength(1);
        const [record] = raw.events;
        // Anything added to this list is metadata handed to whoever can read the IndexedDB
        // file. userId and eventId are the record key, and eventId is bound into the AAD.
        expect(Object.keys(record).sort()).toEqual(["blob", "eventId", "userId"]);
        expect(Object.keys(record.blob).sort()).toEqual(["ct", "iv"]);
        expect(record.userId).toEqual(userId);
        expect(record.eventId).toEqual("$plain");

        const serialised = JSON.stringify(record);
        expect(serialised).not.toContain("!room:example.org");
        expect(serialised).not.toContain("1234567890123");
        expect(serialised).not.toContain("mxc://");
        expect(serialised).not.toContain("secret");

        // Only the index the read path actually uses.
        expect(raw.eventIndexNames).toEqual(["byUser"]);
    });

    it("migrates a v1 database: resets the index and leaves no v1 cleartext behind", async () => {
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const dek = await deriveDek(pickleKey!, salt, userId, DEVICE);
        const stored = {
            event: msg("$v1", "legacy needle"),
            profile: { displayname: "Alice" },
            roomId: "!room:example.org",
            eventId: "$v1",
            originServerTs: 1000,
            searchText: "legacy needle",
            hasFile: false,
            edited: false,
        };
        const blob = await encryptJson(dek, stored, `${userId}|$v1`);

        // A checkpoint exactly as v1 keyed it: the tuple itself was the primary key.
        const v1Checkpoint = {
            roomId: "!v1crawlroom:example.org",
            token: "v1crawltoken",
            direction: Direction.Backward,
        };
        const v1CheckpointId = `${userId}|${v1Checkpoint.roomId}|${v1Checkpoint.token}|${v1Checkpoint.direction}`;
        const cpBlob = await encryptJson(dek, v1Checkpoint, `${userId}|cp|${v1CheckpointId}`);

        // A database exactly as v1 left it on disk.
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open(EVENTINDEX_DB_NAME, 1);
            req.onupgradeneeded = (): void => {
                const db = req.result;
                db.createObjectStore("meta", { keyPath: "userId" });
                const events = db.createObjectStore("events", { keyPath: ["userId", "eventId"] });
                events.createIndex("byUser", "userId", { unique: false });
                events.createIndex("byUserRoom", ["userId", "roomId"], { unique: false });
                const cps = db.createObjectStore("checkpoints", { keyPath: "id" });
                cps.createIndex("byUser", "userId", { unique: false });
            };
            req.onerror = (): void => reject(req.error);
            req.onsuccess = (): void => {
                const db = req.result;
                const tx = db.transaction(["meta", "events", "checkpoints"], "readwrite");
                tx.objectStore("meta").put({ userId, deviceId: DEVICE, salt: encodeBase64(salt), userVersion: 3 });
                tx.objectStore("events").put({
                    userId,
                    eventId: "$v1",
                    roomId: "!room:example.org",
                    ts: 1000,
                    hasFile: 0,
                    blob,
                });
                tx.objectStore("checkpoints").put({ id: v1CheckpointId, userId, blob: cpBlob });
                tx.oncomplete = (): void => {
                    db.close();
                    resolve();
                };
                tx.onerror = (): void => {
                    db.close();
                    reject(tx.error);
                };
            };
        });

        await manager.initEventIndex(userId, DEVICE);

        const raw = await inspectRawDb();
        expect(raw.version).toBe(2);
        // The unused v1 index is gone ...
        expect(raw.eventIndexNames).toEqual(["byUser"]);

        // ... and so are the records. The plaintext-keyed checkpoints cannot be re-keyed inside
        // the versionchange transaction (no key material exists there), so they are deleted; the
        // events go with them, because EventIndex only re-seeds checkpoints for an index that
        // reports itself empty. The pair is what turns "no crawl position" into a full rebuild.
        expect(raw.events).toEqual([]);
        expect(await dumpRawStore("checkpoints")).toEqual([]);
        expect(await manager.isEventIndexEmpty()).toBe(true);
        expect(await manager.loadCheckpoints()).toEqual([]);
        expect((await manager.searchEventIndex(search("legacy"))).count).toBe(0);

        // meta survives, because its salt is what keeps the derived key usable -- minus the
        // `deviceId` column, which nothing ever read.
        expect(Object.keys((await dumpRawStore("meta"))[0]).sort()).toEqual(["salt", "userId", "userVersion"]);
        expect(await manager.getUserVersion()).toBe(3);

        // Nothing v1 wrote in the clear survives anywhere in the database.
        const whole = await dumpWholeDb();
        // Positive control: the dump really does reach the records that are left.
        expect(whole).toContain(userId);
        expect(whole).not.toContain("!room:example.org");
        expect(whole).not.toContain("!v1crawlroom");
        expect(whole).not.toContain("v1crawltoken");
        expect(whole).not.toContain(DEVICE);
    });

    it("redacting an edit removes the redacted body, in memory and on disk", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$orig", "original wording"), {});
        await manager.addEventToIndex(edit("$edit", "$orig", "edited wording"), {});
        await manager.commitLiveEvents();
        expect((await manager.searchEventIndex(search("edited"))).count).toBe(1);

        // EventIndex.redactEvent() deletes by the redacted event's own id, which for an
        // edit is the m.replace, not the original it was indexed under.
        expect(await manager.deleteEvent("$edit")).toBe(true);
        expect((await manager.searchEventIndex(search("edited"))).count).toBe(0);
        // The pre-edit body was overwritten in place, so the whole record goes.
        expect((await manager.searchEventIndex(search("original"))).count).toBe(0);
        expect(await manager.isEventIndexEmpty()).toBe(true);

        await manager.commitLiveEvents();
        expect((await inspectRawDb()).events).toEqual([]);
        // Deleting it again is a no-op rather than a second hit.
        expect(await manager.deleteEvent("$edit")).toBe(false);
    });

    it("still resolves a redacted edit after a reload", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$orig", "original wording"), {});
        await manager.addEventToIndex(edit("$edit", "$orig", "edited wording"), {});
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect(await reloaded.deleteEvent("$edit")).toBe(true);
            expect((await reloaded.searchEventIndex(search("edited"))).count).toBe(0);
            await reloaded.commitLiveEvents();
            expect((await inspectRawDb()).events).toEqual([]);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("drops the rows it already loaded when a later row cannot be decrypted", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$a", "first wording"), {});
        await manager.addEventToIndex(msg("$b", "second wording"), {});
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        // Corrupt the second row only: the first decrypts and is indexed before the failure.
        await withRawDb(async (db) => {
            const store = db.transaction("events", "readwrite").objectStore("events");
            const row = await idbPromise(store.get([userId, "$b"]));
            row.blob.ct = encodeBase64(crypto.getRandomValues(new Uint8Array(64)));
            await idbPromise(store.put(row));
        });

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            expect((await reloaded.searchEventIndex(search("first"))).count).toBe(0);
            expect(await reloaded.isRoomIndexed("!room:example.org")).toBe(false);
            // The crawler relies on this to decide the index needs rebuilding.
            expect(await reloaded.isEventIndexEmpty()).toBe(true);
            expect((await inspectRawDb()).events).toEqual([]);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("closes the previous connection when re-initialising", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const close = vi.spyOn(IDBDatabase.prototype, "close");
        // The settings panel re-inits without closing first.
        await manager.initEventIndex(userId, DEVICE);
        expect(close).toHaveBeenCalled();
    });

    it("leaves the database deletable after re-initialising", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$r", "first session"), {});
        await manager.commitLiveEvents();
        await manager.initEventIndex(userId, DEVICE);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const blocked = vi.fn();
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(EVENTINDEX_DB_NAME);
            req.onsuccess = (): void => resolve();
            req.onerror = (): void => reject(req.error);
            req.onblocked = (): void => blocked();
        });
        expect(blocked).not.toHaveBeenCalled();
    });

    it("drops the whole database on the logout sequence (close, then delete)", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$logout", "logout secret"), {});
        await manager.commitLiveEvents();
        // EventIndexPeg.deleteEventIndex() closes the index before deleting it, which is
        // what takes deleteEventIndex() down its whole-database branch.
        await manager.closeEventIndex();
        await manager.deleteEventIndex();

        const names = (await indexedDB.databases()).map((d) => d.name);
        expect(names).not.toContain(EVENTINDEX_DB_NAME);
    });

    it("probes the same database the manager writes to", async () => {
        await manager.initEventIndex(userId, DEVICE);
        // EVENTINDEX_DB_NAME is not exported, so these tests carry their own copy of the name.
        // This is what keeps the copy honest: rename the constant in the source and this fails
        // here, loudly, instead of every other test quietly inspecting a database nobody wrote.
        expect((await indexedDB.databases()).map((d) => d.name)).toEqual([EVENTINDEX_DB_NAME]);
    });

    it("settles instead of hanging when an older tab blocks the upgrade", async () => {
        // A v1 database held open by a connection with no onversionchange handler -- exactly
        // what a tab running the build that created v1 leaves behind. It never gets out of the
        // way, so the v2 upgrade is blocked for as long as that tab lives.
        const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(EVENTINDEX_DB_NAME, 1);
            req.onupgradeneeded = (): void => {
                const db = req.result;
                db.createObjectStore("meta", { keyPath: "userId" });
                const events = db.createObjectStore("events", { keyPath: ["userId", "eventId"] });
                events.createIndex("byUser", "userId", { unique: false });
                const cps = db.createObjectStore("checkpoints", { keyPath: "id" });
                cps.createIndex("byUser", "userId", { unique: false });
            };
            req.onsuccess = (): void => resolve(req.result);
            req.onerror = (): void => reject(req.error);
        });

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            // A real timeout rather than an await: EventIndexPeg.init() is awaited immediately
            // before MatrixClientPeg.start(), so a promise that never settles here is an
            // application that never starts. A regression must fail this test, not stall the
            // suite until vitest's own timeout kills it.
            const neverSettles = new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error("initEventIndex never settled")), 2000);
            });
            await expect(Promise.race([manager.initEventIndex(userId, DEVICE), neverSettles])).resolves.toBeUndefined();
        } finally {
            clearTimeout(timer);
        }

        // Degraded to memory-only, which is what initEventIndex does with any database it
        // cannot open: searchable for this session, nothing written, no exception.
        await manager.addEventToIndex(msg("$blocked", "still searchable"), {});
        await manager.commitLiveEvents();
        expect((await manager.searchEventIndex(search("searchable"))).count).toBe(1);

        // The blocking tab goes away, so the upgrade queued behind it finally runs. The
        // connection it produces belongs to nobody: openDb has to close it rather than leak a
        // handle that would block deleting the database for the rest of the session.
        v1.close();
        expect(await dumpRawStore("events")).toEqual([]);
        const blocked = vi.fn();
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(EVENTINDEX_DB_NAME);
            req.onsuccess = (): void => resolve();
            req.onerror = (): void => reject(req.error);
            req.onblocked = (): void => blocked();
        });
        expect(blocked).not.toHaveBeenCalled();
    });

    it("does not carry the previous session's key into the next one", async () => {
        // A warm index for a second account, left by an earlier session.
        const other = `${userId}-other`;
        await manager.initEventIndex(other, DEVICE);
        await manager.addEventToIndex(msg("$warm", "warm body"), {});
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        // This account signs in, in the same manager object.
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$first", "first body"), {});
        await manager.commitLiveEvents();

        // And now back to the second account. Between opening the database under the new user
        // id and deriving that user's key there is a window in which the object holds the new
        // id, a live connection and the *previous* DEK -- so a write landing in it is encrypted
        // for one user and filed under the other. Nothing detects that later except the next
        // start-up, which finds ciphertext it cannot open and answers by wiping the user's
        // whole index. Land a write in exactly that window: the key derivation is what opens it.
        const realDeriveKey = crypto.subtle.deriveKey.bind(crypto.subtle);
        let landed = false;
        vi.spyOn(crypto.subtle, "deriveKey").mockImplementation(async (...args) => {
            if (!landed) {
                landed = true;
                await manager.addEventToIndex(msg("$straddle", "straddling body"), {});
            }
            return realDeriveKey(...(args as Parameters<typeof realDeriveKey>));
        });

        await manager.initEventIndex(other, DEVICE);
        await manager.commitLiveEvents();
        expect(landed).toBe(true);

        // The warm index survived, and nothing else was filed under this user.
        expect((await manager.searchEventIndex(search("warm"))).count).toBe(1);
        const rows = await dumpRawStore("events");
        expect(rows.filter((r) => r.userId === other).map((r) => r.eventId)).toEqual(["$warm"]);
    });

    it("does not report a batch of edit repairs as already added", async () => {
        await manager.initEventIndex(userId, DEVICE);
        // The edit arrives first, so the record is filed under the original's id, carries the
        // edit's envelope, and is marked edited.
        await manager.addEventToIndex(edit("$repairedit", "$repairorig", "edited wording"), {});

        // A back-fill page holding only the original. It rewrites that record's envelope and
        // schedules a persist, so it is a change like any other: reporting "all already added"
        // would tell the crawler it had caught up and end the back-fill of a room it has
        // barely started.
        const page = [{ event: msg("$repairorig", "original wording"), profile: {} }];
        expect(await manager.addHistoricEvents(page, null, null)).toBe(false);
    });

    it("ends a file listing when the cursor is no longer indexed", async () => {
        await manager.initEventIndex(userId, DEVICE);
        const file = (id: string, ts: number): any =>
            msg(id, "file", { origin_server_ts: ts, content: { url: "mxc://s/a", msgtype: "m.file" } });
        await manager.addEventToIndex(file("$c1", 1), {});
        await manager.addEventToIndex(file("$c2", 2), {});

        // The panel pages on from an event that has been redacted since it was rendered.
        // Restarting from the first page instead would hand back a page the panel has already
        // shown, and a panel that pages until it gets an empty answer would never get one.
        const page = await manager.loadFileEvents({
            roomId: "!room:example.org",
            limit: 1,
            direction: "f",
            fromEvent: "$redactedmidscroll",
        });
        expect(page).toEqual([]);
    });

    it("reports a size that tracks the records, not the number of writes", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$size", "first body"), {});
        await manager.commitLiveEvents();
        const one = (await manager.getStats()).size;
        expect(one).toBeGreaterThan(0);

        // Three rewrites of the same record. Each is a put, so there is still one row on disk
        // and the reported size must not have grown with the write count.
        for (const body of ["second body", "third body", "fourth body"]) {
            expect(await manager.addHistoricEvents([{ event: msg("$size", body), profile: {} }], null, null)).toBe(
                false,
            );
        }
        await manager.commitLiveEvents();
        expect(await dumpRawStore("events")).toHaveLength(1);
        const rewritten = (await manager.getStats()).size;
        expect(rewritten).toBeLessThan(one * 1.5);

        // A second record adds to it ...
        await manager.addEventToIndex(msg("$size2", "another body"), {});
        await manager.commitLiveEvents();
        const two = (await manager.getStats()).size;
        expect(two).toBeGreaterThan(rewritten);

        // ... and deleting the first gives its bytes back.
        expect(await manager.deleteEvent("$size")).toBe(true);
        await manager.commitLiveEvents();
        const afterDelete = (await manager.getStats()).size;
        expect(afterDelete).toBeLessThan(two);
        expect(afterDelete).toBeGreaterThan(0);
    });

    it("keeps a room's events in timestamp order however they arrive", async () => {
        await manager.initEventIndex(userId, DEVICE);
        // Out of order and with ties, which is the normal case: the crawler pages backwards
        // while the live timeline appends forwards.
        const timestamps = [50, 10, 30, 10, 90, 20, 30, 5, 70, 10];
        const ids = timestamps.map((_ts, i) => `$ord${i}`);
        for (const [i, ts] of timestamps.entries()) {
            await manager.addEventToIndex(msg(ids[i], "ordered needle", { origin_server_ts: ts }), {});
        }
        // Ascending by timestamp, ties in arrival order: what a stable sort of "append, then
        // sort" produced, and what the binary-search insert has to keep producing.
        const expected = ids
            .map((id, i) => ({ id, ts: timestamps[i] }))
            .sort((a, b) => a.ts - b.ts)
            .map((e) => e.id);

        const result = await manager.searchEventIndex(
            search("needle", { before_limit: 20, after_limit: 20, order_by_recency: false, limit: 1 }),
        );
        const [first] = result.results!;
        const seen = [
            ...first.context!.events_before.map((e) => e.event_id),
            first.result.event_id,
            ...first.context!.events_after.map((e) => e.event_id),
        ];
        expect(seen).toEqual(expected);
    });

    it("re-places a record whose timestamp a late original corrects", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$oearly", "early needle", { origin_server_ts: 10 }), {});
        // The edit arrives before its original and is filed under the original's id, carrying
        // the edit's own, much later timestamp ...
        await manager.addEventToIndex(edit("$oedit", "$olate", "late needle", 900), {});
        await manager.addEventToIndex(msg("$omid", "middle needle", { origin_server_ts: 500 }), {});
        // ... and the original then turns up, timestamped before the event in the middle.
        await manager.addEventToIndex(msg("$olate", "original wording", { origin_server_ts: 20 }), {});

        const result = await manager.searchEventIndex(
            search("needle", { before_limit: 20, after_limit: 20, order_by_recency: false, limit: 1 }),
        );
        const [first] = result.results!;
        const seen = [
            ...first.context!.events_before.map((e) => e.event_id),
            first.result.event_id,
            ...first.context!.events_after.map((e) => e.event_id),
        ];
        expect(seen).toEqual(["$oearly", "$olate", "$omid"]);
    });

    it("keeps the substring fallback in step with an edited body", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$fold", "originalwording"), {});
        // A mid-word fragment only the substring fallback can match, which is what fills the
        // folded-text memo.
        expect((await manager.searchEventIndex(search("ginalwo"))).count).toBe(1);

        await manager.addEventToIndex(edit("$foldedit", "$fold", "replacementwording"), {});
        expect((await manager.searchEventIndex(search("ginalwo"))).count).toBe(0);
        expect((await manager.searchEventIndex(search("lacementwo"))).count).toBe(1);
    });

    it("removes a checkpoint that a previous session wrote", async () => {
        const cp = { roomId: "!crawl:example.org", token: "crawltoken", direction: Direction.Backward };
        await manager.initEventIndex(userId, DEVICE);
        await manager.addCrawlerCheckpoint(cp);
        await manager.commitLiveEvents();
        await manager.closeEventIndex();
        expect(await dumpRawStore("checkpoints")).toHaveLength(1);

        // Same user, same device, same pickle key, so the salt comes back out of the meta row
        // and the MAC subkey -- and with it the record key -- is re-derived identically. That
        // determinism across sessions is the only thing that makes a checkpoint written last
        // time addressable this time, and the re-keying rests on it.
        const reloaded = new BrowserEventIndexManager();
        try {
            await reloaded.initEventIndex(userId, DEVICE);
            expect(await reloaded.loadCheckpoints()).toEqual([cp]);
            await reloaded.removeCrawlerCheckpoint({ ...cp });
            await reloaded.commitLiveEvents();
            expect(await reloaded.loadCheckpoints()).toEqual([]);
            expect(await dumpRawStore("checkpoints")).toEqual([]);
        } finally {
            await reloaded.closeEventIndex();
        }
    });

    it("does not let an in-flight write resurrect a record after the wipe", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$race", "racing secret"), {});
        // No commitLiveEvents(): the encrypt-and-put is still queued.
        await manager.deleteEventIndex();
        expect((await inspectRawDb()).events).toEqual([]);
    });
});

describe("BrowserEventIndexManager (the labs gate)", () => {
    const DEVICE = "DEVICE1";
    let manager: BrowserEventIndexManager;
    let userCounter = 0;
    let userId: string;
    let enabled: boolean;

    const search = (term: string, overrides: Record<string, unknown> = {}): any =>
        ({ search_term: term, ...SEARCH_DEFAULTS, ...overrides }) as any;

    beforeEach(() => {
        vi.stubGlobal("indexedDB", new IDBFactory());
        enabled = true;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((): any => enabled);
        userId = `@gated${++userCounter}:example.org`;
        mockPlatformPeg({
            getPickleKey: vi.fn().mockResolvedValue("unit-test-pickle-key"),
        });
        manager = new BrowserEventIndexManager();
    });

    afterEach(async () => {
        await manager.closeEventIndex();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("creates no index at all while the flag is off", async () => {
        enabled = false;
        // WebPlatform hands out an already-constructed manager whatever the setting says, and
        // EventIndexPeg caches supportsEventIndexing() from start-up, so the settings panel's
        // Enable button reaches this with the feature gated off. It must not put a fresh
        // encrypted index on disk.
        await manager.initEventIndex(userId, DEVICE);
        expect(await indexedDB.databases()).toEqual([]);

        await manager.addEventToIndex(msg("$gated", "gated body"), {});
        await manager.commitLiveEvents();
        expect(await indexedDB.databases()).toEqual([]);
        expect(await manager.isEventIndexEmpty()).toBe(true);
    });

    it("stops indexing when the flag goes off mid-session", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$before", "before the flag"), {});
        await manager.commitLiveEvents();
        expect(await dumpRawStore("events")).toHaveLength(1);

        enabled = false;
        await manager.addEventToIndex(msg("$after", "after the flag"), {});
        const page = [{ event: msg("$historic", "historic body"), profile: {} }];
        expect(await manager.addHistoricEvents(page, null, null)).toBe(false);
        await manager.addCrawlerCheckpoint({
            roomId: "!crawl:example.org",
            token: "crawltoken",
            direction: Direction.Backward,
        });
        await manager.commitLiveEvents();

        // Nothing new, in memory or on disk ...
        expect(await dumpRawStore("events")).toHaveLength(1);
        expect(await dumpRawStore("checkpoints")).toEqual([]);
        expect(await manager.loadCheckpoints()).toEqual([]);
        expect((await manager.searchEventIndex(search("after"))).count).toBe(0);
        expect((await manager.searchEventIndex(search("historic"))).count).toBe(0);
        // ... and what was already indexed stays searchable for the rest of the session.
        expect((await manager.searchEventIndex(search("before"))).count).toBe(1);
    });

    it("still removes and tears down with the flag off", async () => {
        await manager.initEventIndex(userId, DEVICE);
        await manager.addEventToIndex(msg("$keep", "keep body"), {});
        await manager.addEventToIndex(msg("$drop", "drop body"), {});
        const cp = { roomId: "!crawl:example.org", token: "crawltoken", direction: Direction.Backward };
        await manager.addCrawlerCheckpoint(cp);
        await manager.commitLiveEvents();

        // Lifecycle.clearStorage() wipes the setting's storage before it asks for the manager,
        // so every path that *removes* something has to keep working with the gate shut.
        enabled = false;
        expect(await manager.deleteEvent("$drop")).toBe(true);
        await manager.removeCrawlerCheckpoint(cp);
        await manager.commitLiveEvents();
        expect((await dumpRawStore("events")).map((r) => r.eventId)).toEqual(["$keep"]);
        expect(await dumpRawStore("checkpoints")).toEqual([]);

        await manager.deleteEventIndex();
        expect(await manager.isEventIndexEmpty()).toBe(true);
        expect(await dumpRawStore("events")).toEqual([]);
        expect(await dumpRawStore("meta")).toEqual([]);
    });
});

/**
 * The corpus the scale tests below run against, built once and re-indexed per test. Every
 * assertion's expected hit set is a filter over *this array*, so nothing has to be counted by
 * hand: the generator is the ground truth and the index is the thing under test.
 *
 * The marker tokens all start `zq`, a digraph no filler word uses, and no two of them share a
 * prefix with each other except the deliberate `zqprefixaa`/`zqprefixbb` pair. That matters
 * because terms of two characters or more also match by prefix, so a marker that was also a
 * prefix of some other term would quietly widen its own expected set.
 */
const SCALE_EVENT_COUNT = 5000;
const SCALE_ROOMS = ["!scale0:example.org", "!scale1:example.org", "!scale2:example.org", "!scale3:example.org"];
const SCALE_BASE_TS = 1_700_000_000_000;

/** Timestamps ascend with the index, so a room's timeline order is simply its events in index order. */
const scaleTs = (i: number): number => SCALE_BASE_TS + i;

const SCALE_CORPUS: any[] = Array.from({ length: SCALE_EVENT_COUNT }, (_unused, i) => {
    const words = [`entry${i}`, `lorem${i % 17}`, `ipsum${i % 23}`, "corpus filler text"];
    if (i % 37 === 0) words.push("zqmarker");
    if (i % 53 === 0) words.push("zqbeta");
    if (i % 41 === 0) words.push("zqprefixaa");
    if (i % 43 === 0) words.push("zqprefixbb");
    // `zqfallbackword` is only ever queried by a fragment from its middle, which no whole term
    // starts with, so those queries can only be answered by the substring fallback.
    if (i % 101 === 0) words.push("zqfallbackword");
    return msg(`$s${i}`, words.join(" "), {
        room_id: SCALE_ROOMS[i % SCALE_ROOMS.length],
        origin_server_ts: scaleTs(i),
    });
});

/** The ids of the corpus events whose index satisfies `predicate`, in index order. */
const scaleIds = (predicate: (i: number) => boolean): string[] =>
    SCALE_CORPUS.filter((_ev, i) => predicate(i)).map((ev) => ev.event_id);

/**
 * A block of events sharing one timestamp, plus two a millisecond newer inserted part way
 * through it. Recency ordering has to put the two newer ones first and leave the tied block in
 * the order the index holds it, which is where an unstable sort would show.
 */
const TIE_ROOM = "!scaletie:example.org";
const TIE_TS = SCALE_BASE_TS + 900_000;
const tied = (id: string, ts: number): any => msg(id, "zqtied tied body", { room_id: TIE_ROOM, origin_server_ts: ts });
const TIE_EVENTS: any[] = [
    ...Array.from({ length: 6 }, (_unused, j) => tied(`$tie${j}`, TIE_TS)),
    tied("$tienewer0", TIE_TS + 1),
    ...Array.from({ length: 6 }, (_unused, j) => tied(`$tie${j + 6}`, TIE_TS)),
    tied("$tienewer1", TIE_TS + 1),
];
/** Newest first, then the tied block in the order it was indexed. */
const TIE_EXPECTED_BY_RECENCY = ["$tienewer0", "$tienewer1", ...Array.from({ length: 12 }, (_unused, j) => `$tie${j}`)];

/**
 * Sixty message/edit pairs indexed twice over: once original-first, once edit-first, in two
 * rooms. Both orders have to end in the same place -- edited body, original's envelope, original's
 * timestamp, and the record filed at the position that timestamp calls for.
 */
const EDIT_PAIRS = 60;
const EDIT_ROOM_ORIGINAL_FIRST = "!scaleeditoriginal:example.org";
const EDIT_ROOM_EDIT_FIRST = "!scaleeditreplacement:example.org";
const EDIT_BASE_TS = SCALE_BASE_TS + 800_000;
/**
 * A permutation of 0..59, so a room's timestamp order is nothing like its arrival order. An
 * edit-first record is filed under the *edit's* much later timestamp and only re-placed when the
 * original turns up, so a repair that never happened leaves arrival order behind and is visible.
 */
const editTs = (j: number): number => EDIT_BASE_TS + ((j * 37) % EDIT_PAIRS);
const editOriginalId = (roomId: string, j: number): string =>
    `$eorig${roomId === EDIT_ROOM_EDIT_FIRST ? "b" : "a"}${j}`;
const editPairs = (roomId: string): Array<{ original: any; replacement: any }> =>
    Array.from({ length: EDIT_PAIRS }, (_unused, j) => {
        const originalId = editOriginalId(roomId, j);
        return {
            original: msg(originalId, `zqpreedit eword${j}`, { room_id: roomId, origin_server_ts: editTs(j) }),
            // `edit` files itself in the default room, so the room id is re-applied on top.
            replacement: {
                ...edit(`$eedit${originalId}`, originalId, `zqpostedit eword${j}`, EDIT_BASE_TS + 100_000 + j),
                room_id: roomId,
            },
        };
    });
const EDIT_ORIGINAL_FIRST = editPairs(EDIT_ROOM_ORIGINAL_FIRST);
const EDIT_EDIT_FIRST = editPairs(EDIT_ROOM_EDIT_FIRST);
/** The room's ids in timestamp order, which is what both arrival orders have to converge on. */
const editExpectedOrder = (roomId: string): string[] =>
    Array.from({ length: EDIT_PAIRS }, (_unused, j) => j)
        .sort((a, b) => editTs(a) - editTs(b))
        .map((j) => editOriginalId(roomId, j));

/**
 * A room of its own for the redaction test, so removing all of it cannot disturb what the other
 * tests assert. Each body carries a per-event term whose middle only the substring fallback can
 * reach, which is what makes the folded-text memo's cleanup observable.
 */
const DOOM_ROOM = "!scaledoom:example.org";
const DOOM_COUNT = 200;
const DOOM_EVENTS: any[] = Array.from({ length: DOOM_COUNT }, (_unused, k) =>
    msg(`$doom${k}`, `zqdoomed zqdoomcarrier${k} filler`, {
        room_id: DOOM_ROOM,
        origin_server_ts: SCALE_BASE_TS + 700_000 + k,
    }),
);

const SCALE_TOTAL_EVENTS = SCALE_EVENT_COUNT + TIE_EVENTS.length + DOOM_COUNT + 2 * EDIT_PAIRS;
/** The four corpus rooms plus the tie room, the redaction room and the two edit rooms. */
const SCALE_TOTAL_ROOMS = SCALE_ROOMS.length + 4;

/** Index the whole corpus, each group in the arrival order that group is about. */
async function indexScaleCorpus(manager: BrowserEventIndexManager): Promise<void> {
    for (const ev of SCALE_CORPUS) await manager.addEventToIndex(ev, {});
    for (const ev of TIE_EVENTS) await manager.addEventToIndex(ev, {});
    for (const ev of DOOM_EVENTS) await manager.addEventToIndex(ev, {});
    for (const { original, replacement } of EDIT_ORIGINAL_FIRST) {
        await manager.addEventToIndex(original, {});
        await manager.addEventToIndex(replacement, {});
    }
    for (const { original, replacement } of EDIT_EDIT_FIRST) {
        await manager.addEventToIndex(replacement, {});
        await manager.addEventToIndex(original, {});
    }
}

/** The event ids of a page of results, in the order the search returned them. */
const resultIds = (result: any): string[] => result.results!.map((r: any) => r.result.event_id);

/**
 * One room's whole id list in the order the index holds it, read the only way a caller can: ask
 * for a single hit with enough context either side to reach both ends of the room.
 */
async function roomTimelineOrder(
    manager: BrowserEventIndexManager,
    term: string,
    roomId: string,
    span: number,
): Promise<string[]> {
    const result = await manager.searchEventIndex({
        search_term: term,
        room_id: roomId,
        before_limit: span,
        after_limit: span,
        order_by_recency: false,
        limit: 1,
    } as any);
    const [first] = result.results!;
    return [
        ...first.context!.events_before.map((e) => e.event_id),
        first.result.event_id,
        ...first.context!.events_after.map((e) => e.event_id),
    ];
}

describe("BrowserEventIndexManager (at scale)", () => {
    const DEVICE = "DEVICE1";
    let manager: BrowserEventIndexManager;
    let userCounter = 0;
    let userId: string;

    const search = (term: string, overrides: Record<string, unknown> = {}): any =>
        ({ search_term: term, ...SEARCH_DEFAULTS, ...overrides }) as any;

    beforeEach(async () => {
        vi.stubGlobal("indexedDB", new IDBFactory());
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        userId = `@scale${++userCounter}:example.org`;
        // No pickle key, so persistence is off. These tests are about the in-memory index, and
        // AES-GCM-encrypting every one of these records per test would cost more than the rest of
        // the file put together while exercising nothing the persistence tests above do not. The
        // reload test below turns persistence back on, at a size where it is affordable.
        mockPlatformPeg({ getPickleKey: vi.fn().mockResolvedValue(null) });
        manager = new BrowserEventIndexManager();
        await manager.initEventIndex(userId, DEVICE);
        await indexScaleCorpus(manager);
    });

    afterEach(async () => {
        await manager.closeEventIndex();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("returns exactly the records carrying a rare term, and nothing near them", async () => {
        // Positive control first: the whole corpus really is in the index, so the negatives below
        // cannot pass by searching an index that was never populated.
        const stats = await manager.getStats();
        expect(stats.eventCount).toBe(SCALE_TOTAL_EVENTS);
        expect(stats.roomCount).toBe(SCALE_TOTAL_ROOMS);

        const expected = scaleIds((i) => i % 37 === 0);
        const hit = await manager.searchEventIndex(search("zqmarker", { limit: SCALE_EVENT_COUNT }));
        expect(hit.count).toBe(expected.length);
        expect(resultIds(hit).sort()).toEqual([...expected].sort());
        // A term nobody wrote finds nothing, rather than the whole corpus.
        expect((await manager.searchEventIndex(search("zqabsentterm"))).count).toBe(0);
    });

    it("intersects several terms instead of unioning them", async () => {
        const marker = scaleIds((i) => i % 37 === 0);
        const beta = scaleIds((i) => i % 53 === 0);
        const both = scaleIds((i) => i % 37 === 0 && i % 53 === 0);
        // The three counts have to differ, or an OR bug would satisfy the assertion below as
        // readily as an AND: 37 and 53 are coprime, so "both" is a small fraction of either.
        expect(both.length).toBeGreaterThan(0);
        expect(both.length).toBeLessThan(Math.min(marker.length, beta.length));

        const hit = await manager.searchEventIndex(search("zqmarker zqbeta", { limit: SCALE_EVENT_COUNT }));
        expect(hit.count).toBe(both.length);
        expect(resultIds(hit).sort()).toEqual([...both].sort());
        expect(hit.highlights).toEqual(["zqmarker", "zqbeta"]);
    });

    it("matches every term a partial query is a prefix of", async () => {
        // No record holds `zqprefix` as a term, so every hit here comes from the prefix walk.
        const expected = scaleIds((i) => i % 41 === 0 || i % 43 === 0);
        const hit = await manager.searchEventIndex(search("zqprefix", { limit: SCALE_EVENT_COUNT }));
        expect(hit.count).toBe(expected.length);
        expect(resultIds(hit).sort()).toEqual([...expected].sort());

        // ... and a longer prefix narrows to one of the two families rather than keeping both.
        const onlyA = scaleIds((i) => i % 41 === 0);
        const narrowed = await manager.searchEventIndex(search("zqprefixa", { limit: SCALE_EVENT_COUNT }));
        expect(resultIds(narrowed).sort()).toEqual([...onlyA].sort());
    });

    it("falls back to a substring scan for a fragment no term starts with", async () => {
        const expected = scaleIds((i) => i % 101 === 0);
        // "allbackwor" sits in the middle of "zqfallbackword": no term starts with it, so the
        // term path returns nothing and the whole answer comes from the linear scan.
        const hit = await manager.searchEventIndex(search("allbackwor", { limit: SCALE_EVENT_COUNT }));
        expect(hit.count).toBe(expected.length);
        expect(resultIds(hit).sort()).toEqual([...expected].sort());
    });

    it("orders by recency newest first, and leaves tied timestamps in index order", async () => {
        // Distinct timestamps: strictly newest first, which for this corpus is index order reversed.
        const expected = scaleIds((i) => i % 37 === 0).reverse();
        const hit = await manager.searchEventIndex(search("zqmarker", { limit: SCALE_EVENT_COUNT }));
        expect(resultIds(hit)).toEqual(expected);

        // Tied timestamps: the two newer records come first, and the tied block keeps the order
        // the index holds it in. A sort that is not stable reorders the block instead.
        const tiedHit = await manager.searchEventIndex(search("zqtied", { limit: TIE_EVENTS.length }));
        expect(tiedHit.count).toBe(TIE_EVENTS.length);
        expect(resultIds(tiedHit)).toEqual(TIE_EXPECTED_BY_RECENCY);
        const timestamps = tiedHit.results!.map((r) => r.result.origin_server_ts!);
        expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));

        // Without the flag the caller gets the index's own order, not a reversed one.
        const unordered = await manager.searchEventIndex(
            search("zqtied", { limit: TIE_EVENTS.length, order_by_recency: false }),
        );
        expect(resultIds(unordered)).toEqual(TIE_EVENTS.map((e) => e.event_id));
    });

    it("pages through the whole result set with next_batch, with no gaps and no duplicates", async () => {
        const pageSize = 25;
        const single = await manager.searchEventIndex(search("zqmarker", { limit: SCALE_EVENT_COUNT }));
        const expected = resultIds(single);
        expect(expected.length).toBeGreaterThan(pageSize * 2);

        const walked: string[] = [];
        const pageLengths: number[] = [];
        let nextBatch: string | undefined;
        let guard = 0;
        do {
            const page = await manager.searchEventIndex(search("zqmarker", { limit: pageSize, next_batch: nextBatch }));
            // `count` is the size of the whole result set on every page, not of the page.
            expect(page.count).toBe(expected.length);
            // `rank` is positional over the whole result set, so it is what a broken offset
            // corrupts first, before any id even moves.
            expect(page.results![0].rank).toBeCloseTo(1 / (walked.length + 1), 12);
            pageLengths.push(page.results!.length);
            walked.push(...resultIds(page));
            nextBatch = page.next_batch;
        } while (nextBatch !== undefined && ++guard < 100);

        expect(nextBatch).toBeUndefined();
        expect(walked).toEqual(expected);
        expect(new Set(walked).size).toBe(walked.length);
        expect(pageLengths).toEqual([
            ...Array.from({ length: Math.floor(expected.length / pageSize) }, () => pageSize),
            ...(expected.length % pageSize ? [expected.length % pageSize] : []),
        ]);
    });

    it("returns the hit's true timeline neighbours as context", async () => {
        // Every fourth event shares a room, so the neighbours of $s1850 are $s1846 and $s1854.
        const middle = await manager.searchEventIndex(search("entry1850", { before_limit: 3, after_limit: 3 }));
        expect(middle.count).toBe(1);
        const context = middle.results![0].context!;
        expect(context.events_before.map((e) => e.event_id)).toEqual(["$s1838", "$s1842", "$s1846"]);
        expect(context.events_after.map((e) => e.event_id)).toEqual(["$s1854", "$s1858", "$s1862"]);

        // The first event of a room has nothing before it, rather than wrapping to the end.
        const first = await manager.searchEventIndex(search("entry0", { before_limit: 3, after_limit: 2 }));
        const firstContext = first.results![0].context!;
        expect(firstContext.events_before).toEqual([]);
        expect(firstContext.events_after.map((e) => e.event_id)).toEqual(["$s4", "$s8"]);

        // Tied timestamps land where a stable "append, then sort" would have put them: arrival
        // order inside the tie, and the two newer records after all of it -- so the insertion
        // point has to be the tie's *upper* bound, not its lower one.
        expect(await roomTimelineOrder(manager, "zqtied", TIE_ROOM, TIE_EVENTS.length)).toEqual([
            ...Array.from({ length: 12 }, (_unused, j) => `$tie${j}`),
            "$tienewer0",
            "$tienewer1",
        ]);
    });

    it("converges on the same state whether an edit arrives before or after its original", async () => {
        // No pre-edit body survives in either room ...
        expect((await manager.searchEventIndex(search("zqpreedit", { limit: SCALE_EVENT_COUNT }))).count).toBe(0);

        // ... every record is filed under its original's id, carrying the edited body ...
        const hit = await manager.searchEventIndex(search("zqpostedit", { limit: SCALE_EVENT_COUNT }));
        expect(hit.count).toBe(2 * EDIT_PAIRS);
        const expectedIds = [
            ...editExpectedOrder(EDIT_ROOM_ORIGINAL_FIRST),
            ...editExpectedOrder(EDIT_ROOM_EDIT_FIRST),
        ];
        expect(resultIds(hit).sort()).toEqual([...expectedIds].sort());
        for (const result of hit.results!) {
            expect((result.result.content as any).body).toMatch(/^zqpostedit /);
        }

        // ... and both rooms sit in their originals' timestamp order, not their arrival order.
        // The edit-first room only gets there because the late original re-places the record.
        for (const roomId of [EDIT_ROOM_ORIGINAL_FIRST, EDIT_ROOM_EDIT_FIRST]) {
            expect(await roomTimelineOrder(manager, "zqpostedit", roomId, EDIT_PAIRS)).toEqual(
                editExpectedOrder(roomId),
            );
        }
    });

    it("removes every trace of a redacted room's events at scale", async () => {
        expect((await manager.searchEventIndex(search("zqdoomed", { limit: DOOM_COUNT }))).count).toBe(DOOM_COUNT);
        // A fragment only the substring fallback reaches, which is what fills the folded-text memo.
        expect((await manager.searchEventIndex(search("qdoomcarrie", { limit: DOOM_COUNT }))).count).toBe(DOOM_COUNT);

        for (const ev of DOOM_EVENTS) expect(await manager.deleteEvent(ev.event_id)).toBe(true);

        expect((await manager.searchEventIndex(search("zqdoomed", { limit: DOOM_COUNT }))).count).toBe(0);
        expect((await manager.searchEventIndex(search("qdoomcarrie", { limit: DOOM_COUNT }))).count).toBe(0);
        expect(await manager.isRoomIndexed(DOOM_ROOM)).toBe(false);
        // The rest of the index is untouched.
        const stats = await manager.getStats();
        expect(stats.eventCount).toBe(SCALE_TOTAL_EVENTS - DOOM_COUNT);
        expect(stats.roomCount).toBe(SCALE_TOTAL_ROOMS - 1);
        expect((await manager.searchEventIndex(search("zqmarker", { limit: SCALE_EVENT_COUNT }))).count).toBe(
            scaleIds((i) => i % 37 === 0).length,
        );
    });

    it("scopes a search to one room exactly, on both the term and the substring path", async () => {
        const roomId = SCALE_ROOMS[1];
        const expected = scaleIds((i) => i % 37 === 0 && i % SCALE_ROOMS.length === 1);
        expect(expected.length).toBeGreaterThan(0);

        const scoped = await manager.searchEventIndex(
            search("zqmarker", { room_id: roomId, limit: SCALE_EVENT_COUNT }),
        );
        expect(scoped.count).toBe(expected.length);
        expect(resultIds(scoped).sort()).toEqual([...expected].sort());
        for (const result of scoped.results!) expect(result.result.room_id).toEqual(roomId);

        // The substring fallback takes the room filter too, rather than scanning everything.
        const fragmentExpected = scaleIds((i) => i % 101 === 0 && i % SCALE_ROOMS.length === 1);
        const fragment = await manager.searchEventIndex(
            search("allbackwor", { room_id: roomId, limit: SCALE_EVENT_COUNT }),
        );
        expect(resultIds(fragment).sort()).toEqual([...fragmentExpected].sort());
    });
});

/**
 * The same properties over a warm start rather than a live index, at a size where encrypting and
 * decrypting every record is affordable. This is the path the scale tests above deliberately skip:
 * `loadAllForUser` rebuilds the inverted index and the room order from ciphertext, and sorts each
 * room once instead of inserting record by record.
 */
const RELOAD_EVENT_COUNT = 300;
const RELOAD_ROOMS = ["!warm0:example.org", "!warm1:example.org", "!warm2:example.org"];
const RELOAD_CORPUS: any[] = Array.from({ length: RELOAD_EVENT_COUNT }, (_unused, i) =>
    msg(`$w${i}`, [`warmentry${i}`, "warm corpus", ...(i % 7 === 0 ? ["zqwarmmarker"] : [])].join(" "), {
        room_id: RELOAD_ROOMS[i % RELOAD_ROOMS.length],
        // Descending timestamps, so a reload that kept row order rather than sorting is visible.
        origin_server_ts: SCALE_BASE_TS + (RELOAD_EVENT_COUNT - i),
    }),
);

describe("BrowserEventIndexManager (a persisted index at scale)", () => {
    const DEVICE = "DEVICE1";
    let manager: BrowserEventIndexManager;
    let userCounter = 0;
    let userId: string;

    const search = (term: string, overrides: Record<string, unknown> = {}): any =>
        ({ search_term: term, ...SEARCH_DEFAULTS, ...overrides }) as any;

    beforeEach(() => {
        vi.stubGlobal("indexedDB", new IDBFactory());
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        userId = `@warm${++userCounter}:example.org`;
        mockPlatformPeg({ getPickleKey: vi.fn().mockResolvedValue("unit-test-pickle-key") });
        manager = new BrowserEventIndexManager();
    });

    afterEach(async () => {
        await manager.closeEventIndex();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("rebuilds the same search results and the same room order from stored ciphertext", async () => {
        await manager.initEventIndex(userId, DEVICE);
        for (const ev of RELOAD_CORPUS) await manager.addEventToIndex(ev, {});
        await manager.commitLiveEvents();
        await manager.closeEventIndex();

        const expectedMarker = RELOAD_CORPUS.filter((_ev, i) => i % 7 === 0);
        // Newest first, and the corpus timestamps descend with the index, so this is index order.
        const expectedByRecency = expectedMarker.map((ev) => ev.event_id);
        // Room order is ascending by timestamp, which for this corpus reverses the room's events.
        const expectedRoomOrder = RELOAD_CORPUS.filter((ev) => ev.room_id === RELOAD_ROOMS[0])
            .map((ev) => ev.event_id)
            .reverse();

        const reloaded = new BrowserEventIndexManager();
        await reloaded.initEventIndex(userId, DEVICE);
        try {
            const stats = await reloaded.getStats();
            expect(stats.eventCount).toBe(RELOAD_EVENT_COUNT);
            expect(stats.roomCount).toBe(RELOAD_ROOMS.length);
            expect(stats.size).toBeGreaterThan(0);

            const hit = await reloaded.searchEventIndex(search("zqwarmmarker", { limit: RELOAD_EVENT_COUNT }));
            expect(hit.count).toBe(expectedMarker.length);
            expect(resultIds(hit)).toEqual(expectedByRecency);

            // The substring fallback works off text rebuilt from ciphertext, not off a memo that
            // only a live insert would have filled.
            expect((await reloaded.searchEventIndex(search("armentry150"))).count).toBe(1);

            // `loadAllForUser` sorts each room once on the way in rather than inserting record by
            // record, so this is the assertion that the two agree about what ordered means.
            expect(await roomTimelineOrder(reloaded, "warm", RELOAD_ROOMS[0], RELOAD_EVENT_COUNT)).toEqual(
                expectedRoomOrder,
            );

            // Pagination walks the reloaded set the same way it walks a live one.
            const walked: string[] = [];
            let nextBatch: string | undefined;
            do {
                const page = await reloaded.searchEventIndex(
                    search("zqwarmmarker", { limit: 10, next_batch: nextBatch }),
                );
                walked.push(...resultIds(page));
                nextBatch = page.next_batch;
            } while (nextBatch !== undefined);
            expect(walked).toEqual(expectedByRecency);
        } finally {
            await reloaded.closeEventIndex();
        }
    });
});
