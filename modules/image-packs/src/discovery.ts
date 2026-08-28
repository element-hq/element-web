/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod";

import {
    IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE,
    IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
    LEGACY_MSC2654_DISCOVERY_SOURCES_EVENT_TYPE,
    LEGACY_MSC2654_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
    type DiscoveryIndex,
    type DiscoveryIndexEntry,
    type DiscoverySource,
} from "./types.ts";

export class DiscoverySourceError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "DiscoverySourceError";
    }
}

const sourceSchema = z.object({
    id: z.string().min(1),
    url: z
        .string()
        .url()
        .refine((url) => /^https?:\/\//i.test(url), {
            message: "Discovery source URL must use http or https.",
        }),
    displayName: z.string().optional(),
});

const indexEntrySchema = z.object({
    id: z.string().min(1),
    url: z
        .string()
        .url()
        .refine((url) => /^https?:\/\//i.test(url), {
            message: "Pack URL must use http or https.",
        }),
    display_name: z.string().optional(),
    avatar_url: z.string().optional(),
    attribution: z.string().optional(),
});
const indexSchema = z.union([z.object({ packs: z.array(indexEntrySchema) }), z.array(indexEntrySchema)]);

interface RawDiscoveryIndexEntry {
    id: string;
    url: string;
    display_name?: string;
    avatar_url?: string;
    attribution?: string;
}

export interface AccountDataLike {
    getContent(): unknown;
}

export type AccountDataContentUpdate =
    | object
    | ((current: unknown) => object | undefined | Promise<object | undefined>);

export interface AccountDataTransaction {
    get(eventType: string): unknown;
    /** Bypass a transaction snapshot when a write must include remote changes received after the initial read. */
    getLatest?(eventType: string): Promise<unknown>;
    set(eventType: string, content: AccountDataContentUpdate): Promise<unknown>;
}

export type AccountDataTransactionCallback<T> = (transaction: AccountDataTransaction) => Promise<T> | T;

export interface AccountDataWriter {
    getAccountData(eventType: string): AccountDataLike | null | undefined;
    getAccountDataFromServer?(eventType: string): Promise<unknown | null>;
    setAccountData(eventType: string, content: unknown): Promise<unknown>;
    runAccountDataTransaction?<T>(callback: AccountDataTransactionCallback<T>): Promise<T>;
}

const DISCOVERY_SOURCE_EVENT_TYPES = [
    IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE,
    IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
    LEGACY_MSC2654_DISCOVERY_SOURCES_EVENT_TYPE,
    LEGACY_MSC2654_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
] as const;

const transactionQueues = new WeakMap<object, Promise<unknown>>();

async function runAccountDataTransaction<T>(
    writer: AccountDataWriter,
    update: AccountDataTransactionCallback<T>,
): Promise<T> {
    if (writer.runAccountDataTransaction) return writer.runAccountDataTransaction(update);

    const previous = transactionQueues.get(writer) ?? Promise.resolve();
    const operation = previous
        .catch(() => undefined)
        .then(async () => {
            const values = new Map<string, unknown>();
            const written = new Set<string>();
            const getLatest = async (eventType: string): Promise<unknown> => {
                if (written.has(eventType)) return values.get(eventType);
                if (writer.getAccountDataFromServer) {
                    try {
                        const current = await writer.getAccountDataFromServer(eventType);
                        if (current !== undefined) {
                            values.set(eventType, current ?? undefined);
                            return values.get(eventType);
                        }
                    } catch {
                        // Keep the synchronized local value if a refresh fails so the write can still proceed.
                    }
                }
                const current = writer.getAccountData(eventType)?.getContent();
                return current;
            };
            const transaction: AccountDataTransaction = {
                get: (eventType) =>
                    written.has(eventType) ? values.get(eventType) : writer.getAccountData(eventType)?.getContent(),
                getLatest,
                set: async (eventType, content) => {
                    const next = typeof content === "function" ? await content(await getLatest(eventType)) : content;
                    if (next === undefined) return {};
                    values.set(eventType, next);
                    written.add(eventType);
                    return writer.setAccountData(eventType, next);
                },
            };
            return update(transaction);
        });
    transactionQueues.set(
        writer,
        operation.then(
            () => undefined,
            () => undefined,
        ),
    );
    return operation;
}

function deriveDisplayName(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.host;
    } catch {
        return url;
    }
}

function normaliseSource(source: DiscoverySource): DiscoverySource {
    return { id: source.id, url: source.url, displayName: source.displayName ?? deriveDisplayName(source.url) };
}

function mergeSources(sources: readonly DiscoverySource[]): DiscoverySource[] {
    const byId = new Map<string, DiscoverySource>();
    for (const source of sources) byId.set(source.id, normaliseSource(source));
    return [...byId.values()];
}

function hasAccountData(writer: AccountDataWriter, eventType: string): boolean {
    const event = writer.getAccountData(eventType);
    return event !== null && event !== undefined && event.getContent() !== undefined;
}

function readSourcesFromContent(content: unknown): DiscoverySource[] {
    if (!content || typeof content !== "object") return [];
    const record = content as Record<string, unknown>;
    const list = Array.isArray(record.sources) ? record.sources : Array.isArray(content) ? content : [];
    const out: DiscoverySource[] = [];
    for (const entry of list) {
        const parsed = sourceSchema.safeParse(entry);
        if (!parsed.success) continue;
        out.push(normaliseSource(parsed.data));
    }
    return out;
}

function readSources(writer: AccountDataWriter, eventType: string): DiscoverySource[] {
    return readSourcesFromContent(writer.getAccountData(eventType)?.getContent());
}

/**
 * Read the user's configured image-pack discovery sources. The private stable
 * key is authoritative when present, with legacy and unstable keys as fallbacks.
 */
export function readDiscoverySources(writer: AccountDataWriter): DiscoverySource[] {
    for (const eventType of [IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE, LEGACY_MSC2654_DISCOVERY_SOURCES_EVENT_TYPE]) {
        if (hasAccountData(writer, eventType)) return mergeSources(readSources(writer, eventType));
    }
    for (const eventType of [
        IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
        LEGACY_MSC2654_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
    ]) {
        if (hasAccountData(writer, eventType)) return mergeSources(readSources(writer, eventType));
    }
    return [];
}

export async function addDiscoverySource(
    writer: AccountDataWriter,
    source: DiscoverySource,
): Promise<DiscoverySource[]> {
    const parsed = sourceSchema.safeParse({ ...source, id: source.id.trim(), url: source.url.trim() });
    if (!parsed.success) throw new DiscoverySourceError(parsed.error.issues[0]?.message ?? "Invalid discovery source.");
    return runAccountDataTransaction(writer, async (transaction) => {
        let next: DiscoverySource[] = [];
        await transaction.set(IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE, async (current) => {
            const fallback = await Promise.all(
                DISCOVERY_SOURCE_EVENT_TYPES.filter(
                    (eventType) => eventType !== IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE,
                ).map((eventType) => transaction.getLatest?.(eventType) ?? transaction.get(eventType)),
            );
            const sources = mergeSources([
                ...readSourcesFromContent(current),
                ...fallback.flatMap((content) => readSourcesFromContent(content)),
            ]);
            next = [...sources.filter((item) => item.id !== parsed.data.id), normaliseSource(parsed.data)];
            return { sources: next };
        });
        return next;
    });
}

export async function removeDiscoverySource(writer: AccountDataWriter, sourceId: string): Promise<DiscoverySource[]> {
    return runAccountDataTransaction(writer, async (transaction) => {
        let next: DiscoverySource[] = [];
        await transaction.set(IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE, async (current) => {
            const fallback = await Promise.all(
                DISCOVERY_SOURCE_EVENT_TYPES.filter(
                    (eventType) => eventType !== IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE,
                ).map((eventType) => transaction.getLatest?.(eventType) ?? transaction.get(eventType)),
            );
            const sources = mergeSources([
                ...readSourcesFromContent(current),
                ...fallback.flatMap((content) => readSourcesFromContent(content)),
            ]);
            next = sources.filter((source) => source.id !== sourceId);
            return { sources: next };
        });
        return next;
    });
}

export interface DiscoveryFetcher {
    fetchJson(url: string, init?: RequestInit): Promise<unknown>;
}

const defaultFetcher: DiscoveryFetcher = {
    async fetchJson(url, init) {
        const res = await fetch(url, init);
        if (!res.ok) throw new DiscoverySourceError(`HTTP ${res.status} fetching ${url}.`);
        return res.json();
    },
};

function parseIndex(sourceUrl: string, raw: unknown): DiscoveryIndex {
    const parsed = indexSchema.safeParse(raw);
    if (!parsed.success) {
        throw new DiscoverySourceError("Discovery index did not match the expected shape.");
    }
    const rawEntries: RawDiscoveryIndexEntry[] = Array.isArray(parsed.data) ? parsed.data : parsed.data.packs;
    return {
        sourceUrl,
        packs: rawEntries.map((entry): DiscoveryIndexEntry => {
            const out: DiscoveryIndexEntry = { id: entry.id, url: entry.url };
            if (entry.display_name) out.displayName = entry.display_name;
            if (entry.avatar_url) out.avatarUrl = entry.avatar_url;
            if (entry.attribution) out.attribution = entry.attribution;
            return out;
        }),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fill optional pack metadata from an index entry without overwriting the pack's own values. */
export function mergeDiscoveryPackMetadata(payload: unknown, entry: DiscoveryIndexEntry): unknown {
    if (!isRecord(payload)) return payload;
    const packValue = payload.pack;
    const isLegacyEnvelope = payload.version === 1 && isRecord(packValue) && "images" in packValue;
    if (isLegacyEnvelope && isRecord(packValue)) {
        if (isRecord(packValue.pack)) {
            const metadata = { ...packValue.pack };
            if (metadata.display_name === undefined && entry.displayName !== undefined) {
                metadata.display_name = entry.displayName;
            }
            if (metadata.avatar_url === undefined && entry.avatarUrl !== undefined) {
                metadata.avatar_url = entry.avatarUrl;
            }
            if (metadata.attribution === undefined && entry.attribution !== undefined) {
                metadata.attribution = entry.attribution;
            }
            return { ...payload, pack: { ...packValue, pack: metadata } };
        }
        const pack = { ...packValue };
        if (pack.displayName === undefined && entry.displayName !== undefined) pack.displayName = entry.displayName;
        if (pack.avatarUrl === undefined && entry.avatarUrl !== undefined) pack.avatarUrl = entry.avatarUrl;
        if (pack.attribution === undefined && entry.attribution !== undefined) pack.attribution = entry.attribution;
        return { ...payload, pack };
    }
    const pack = isRecord(payload.pack) ? { ...payload.pack } : {};
    if (pack.display_name === undefined && entry.displayName !== undefined) pack.display_name = entry.displayName;
    if (pack.avatar_url === undefined && entry.avatarUrl !== undefined) pack.avatar_url = entry.avatarUrl;
    if (pack.attribution === undefined && entry.attribution !== undefined) pack.attribution = entry.attribution;
    return { ...payload, pack };
}

/**
 * Fetch a discovery index from a configured source URL. The fetcher is
 * injectable so tests can avoid the network and so host apps can route
 * requests through a proxy.
 */
export async function resolveDiscoverySource(
    source: DiscoverySource,
    fetcher: DiscoveryFetcher = defaultFetcher,
): Promise<DiscoveryIndex> {
    const raw = await fetcher.fetchJson(source.url);
    return parseIndex(source.url, raw);
}

/**
 * Fetch a single pack JSON from a discovery index entry. The returned
 * `unknown` value is the on-the-wire MSC2545 `images`/`pack` layout and
 * should be passed through {@link parsePackJson} before installation.
 */
export async function fetchDiscoveryPack(
    entry: DiscoveryIndexEntry,
    fetcher: DiscoveryFetcher = defaultFetcher,
): Promise<unknown> {
    return fetcher.fetchJson(entry.url);
}
