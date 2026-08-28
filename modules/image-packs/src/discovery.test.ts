/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import {
    addDiscoverySource,
    fetchDiscoveryPack,
    mergeDiscoveryPackMetadata,
    readDiscoverySources,
    removeDiscoverySource,
    resolveDiscoverySource,
} from "./discovery.ts";
import { IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE, IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE } from "./types.ts";
import type { AccountDataWriter } from "./discovery.ts";

class FakeWriter implements AccountDataWriter {
    private store = new Map<string, Record<string, unknown>>();
    public getAccountDataFromServer?: (eventType: string) => Promise<unknown | null>;

    public constructor(private readonly delayWrites = false) {}

    public getAccountData(eventType: string): { getContent(): Record<string, unknown> | undefined } {
        const content = this.store.get(eventType);
        return { getContent: () => content };
    }

    public async setAccountData(eventType: string, content: unknown): Promise<unknown> {
        if (this.delayWrites) await new Promise<void>((resolve) => setTimeout(resolve, 0));
        this.store.set(eventType, content as Record<string, unknown>);
        return {};
    }

    public raw(eventType: string): Record<string, unknown> | undefined {
        return this.store.get(eventType);
    }
}

describe("image-pack discovery sources", () => {
    it("adds and reads a source from the stable event type", async () => {
        const writer = new FakeWriter();
        const list = await addDiscoverySource(writer, { id: "test", url: "https://example.org/index.json" });
        expect(list.map((s) => s.id)).toEqual(["test"]);
        expect(writer.raw(IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE)).toEqual({
            sources: [{ id: "test", url: "https://example.org/index.json", displayName: "example.org" }],
        });
        expect(readDiscoverySources(writer).map((s) => s.id)).toEqual(["test"]);
    });

    it("falls back to the unstable event type when the stable one is empty", async () => {
        const writer = new FakeWriter();
        await writer.setAccountData(IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE, {
            sources: [{ id: "u", url: "https://example.org/u.json" }],
        });
        expect(readDiscoverySources(writer).map((s) => s.id)).toEqual(["u"]);
    });

    it("keeps a present stable event authoritative even when it is empty", async () => {
        const writer = new FakeWriter();
        await writer.setAccountData(IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE, { sources: [] });
        await writer.setAccountData(IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE, {
            sources: [{ id: "u", url: "https://example.org/u.json" }],
        });
        expect(readDiscoverySources(writer)).toEqual([]);
    });

    it("removes a source by id", async () => {
        const writer = new FakeWriter();
        await addDiscoverySource(writer, { id: "a", url: "https://example.org/a.json" });
        await addDiscoverySource(writer, { id: "b", url: "https://example.org/b.json" });
        const after = await removeDiscoverySource(writer, "a");
        expect(after.map((s) => s.id)).toEqual(["b"]);
    });

    it("rejects sources missing id or url", async () => {
        const writer = new FakeWriter();
        await expect(addDiscoverySource(writer, { id: "", url: "https://e/" })).rejects.toThrow();
        await expect(addDiscoverySource(writer, { id: "x", url: "" })).rejects.toThrow();
        await expect(addDiscoverySource(writer, { id: "x", url: "not a url" })).rejects.toThrow();
    });

    it("merges legacy unstable sources when adding a stable source", async () => {
        const writer = new FakeWriter();
        await writer.setAccountData(IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE, {
            sources: [{ id: "old", url: "https://example.org/old.json" }],
        });
        const list = await addDiscoverySource(writer, { id: "new", url: "https://example.org/new.json" });
        expect(list.map((source) => source.id).sort()).toEqual(["new", "old"]);
    });

    it("preserves concurrent source additions", async () => {
        const writer = new FakeWriter(true);
        await Promise.all([
            addDiscoverySource(writer, { id: "a", url: "https://example.org/a.json" }),
            addDiscoverySource(writer, { id: "b", url: "https://example.org/b.json" }),
        ]);
        expect(
            readDiscoverySources(writer)
                .map((source) => source.id)
                .sort(),
        ).toEqual(["a", "b"]);
    });

    it("refreshes the stable source list before applying an update", async () => {
        const writer = new FakeWriter();
        await writer.setAccountData(IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE, {
            sources: [{ id: "stale", url: "https://example.org/stale.json" }],
        });
        writer.getAccountDataFromServer = async (eventType) => {
            if (eventType === IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE) {
                return { sources: [{ id: "remote", url: "https://example.org/remote.json" }] };
            }
            return writer.getAccountData(eventType)?.getContent() ?? null;
        };

        const list = await addDiscoverySource(writer, { id: "local", url: "https://example.org/local.json" });

        expect(list.map((source) => source.id).sort()).toEqual(["local", "remote"]);
        expect(writer.raw(IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE)).toEqual({
            sources: [
                { id: "remote", url: "https://example.org/remote.json", displayName: "example.org" },
                { id: "local", url: "https://example.org/local.json", displayName: "example.org" },
            ],
        });
    });

    it("fills missing pack metadata from the discovery index", () => {
        expect(
            mergeDiscoveryPackMetadata(
                { images: { wave: { url: "mxc://example.org/wave" } } },
                { id: "wave", url: "https://example.org/wave.json", displayName: "Waves" },
            ),
        ).toEqual({
            images: { wave: { url: "mxc://example.org/wave" } },
            pack: { display_name: "Waves" },
        });
    });

    it("parses a discovery index and fetches a single pack", async () => {
        const fetcher = {
            async fetchJson(url: string): Promise<unknown> {
                if (url.endsWith("index.json")) {
                    return {
                        packs: [
                            { id: "one", url: "https://example.org/one.json", display_name: "One" },
                            { id: "two", url: "https://example.org/two.json" },
                        ],
                    };
                }
                return { images: { hi: { url: "mxc://example.org/hi" } }, pack: { display_name: "hi" } };
            },
        };
        const source = { id: "src", url: "https://example.org/index.json" };
        const index = await resolveDiscoverySource(source, fetcher);
        expect(index.packs.map((p) => p.id)).toEqual(["one", "two"]);
        const pack = await fetchDiscoveryPack(index.packs[0], fetcher);
        expect(pack).toEqual({
            images: { hi: { url: "mxc://example.org/hi" } },
            pack: { display_name: "hi" },
        });
    });

    it("rejects malformed discovery indices", async () => {
        const fetcher = {
            async fetchJson(): Promise<unknown> {
                return { wrong: true };
            },
        };
        await expect(resolveDiscoverySource({ id: "x", url: "https://e/" }, fetcher)).rejects.toThrow();
    });
});
