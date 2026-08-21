/*
Copyright 2026 inblock.io
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.

Browser EventIndex backend for Element Web.

Implements BaseEventIndexManager so the stock Search UX works in the browser.
Storage is AES-GCM ciphertext in a dedicated IndexedDB; the wrapping key is
derived from the session pickle key (destroyed on logout) and is never written
to localStorage. This is not a Seshat port.
*/

import { logger } from "matrix-js-sdk/src/logger";
import {
    type IMatrixProfile,
    type IEventWithRoomId as IMatrixEvent,
    type IResultRoomEvents,
} from "matrix-js-sdk/src/matrix";

import BaseEventIndexManager, {
    type ICrawlerCheckpoint,
    type IEventAndProfile,
    type IIndexStats,
    type ISearchArgs,
    type ILoadArgs,
} from "../../indexing/BaseEventIndexManager";
import PlatformPeg from "../../PlatformPeg";
import SettingsStore from "../../settings/SettingsStore";

const log = logger.getChild("BrowserEventIndex");

/** Dedicated DB — not the crypto store, not `matrix-react-sdk`. */
export const EVENTINDEX_DB_NAME = "element-eventindex";
export const EVENTINDEX_DB_VERSION = 1;
export const EVENTINDEX_HKDF_INFO = "element-eventindex-v1";


interface StoredEvent {
    event: IMatrixEvent;
    profile: IMatrixProfile;
    roomId: string;
    eventId: string;
    originServerTs: number;
    searchText: string;
    hasFile: boolean;
    /** True once an m.replace has been applied. Later originals must not revert the body. */
    edited: boolean;
}

interface EncryptedBlob {
    iv: string;
    ct: string;
}

interface MetaRecord {
    userId: string;
    deviceId: string;
    salt: string;
    userVersion: number;
}

interface EventRecord {
    userId: string;
    eventId: string;
    roomId: string;
    ts: number;
    hasFile: number;
    blob: EncryptedBlob;
}

interface CheckpointRecord {
    id: string;
    userId: string;
    blob: EncryptedBlob;
}

function bytesToB64(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

/** Lowercase + strip combining marks so café matches cafe. */
export function foldText(text: string): string {
    return text
        .toLocaleLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}+/gu, "");
}

export function tokenize(text: string): string[] {
    if (!text) return [];
    return foldText(text)
        .split(/[^\p{L}\p{N}_]+/u)
        .filter((t) => t.length > 0);
}

export function replacedEventId(ev: IMatrixEvent): string | null {
    const rel = ev.content?.["m.relates_to"];
    if (rel && rel.rel_type === "m.replace" && typeof rel.event_id === "string" && rel.event_id.length > 0) {
        return rel.event_id;
    }
    return null;
}

function stripHtml(s: string): string {
    return s.replace(/<[^>]+>/g, " ");
}

function collectText(value: unknown, into: string[]): void {
    if (typeof value === "string") {
        if (value.length > 0) into.push(value);
        return;
    }
    if (!value || typeof value !== "object") return;
    const o = value as Record<string, unknown>;
    if (typeof o.body === "string") into.push(o.body);
    if (typeof o.filename === "string") into.push(o.filename);
    if (typeof o.formatted_body === "string") into.push(stripHtml(o.formatted_body));
    if (o["m.caption"] !== undefined) collectText(o["m.caption"], into);
    if (o["org.matrix.msc1767.caption"] !== undefined) collectText(o["org.matrix.msc1767.caption"], into);
    const markup = o["m.markup"] ?? o["org.matrix.msc1767.markup"];
    if (Array.isArray(markup)) {
        for (const part of markup) collectText(part, into);
    }
}

export function extractSearchText(ev: IMatrixEvent): string {
    const type = ev.type;
    if (type === "m.room.name") return typeof ev.content?.name === "string" ? ev.content.name : "";
    if (type === "m.room.topic") return typeof ev.content?.topic === "string" ? ev.content.topic : "";
    const parts: string[] = [];
    collectText(ev.content, parts);
    const neu = ev.content?.["m.new_content"];
    if (neu) collectText(neu, parts);
    return parts.filter((p) => p.length > 0).join(" ");
}

export function eventHasFile(ev: IMatrixEvent): boolean {
    const url = ev.content?.url ?? ev.content?.file?.url;
    return typeof url === "string" && url.startsWith("mxc://");
}

export function effectiveEventForIndex(ev: IMatrixEvent): IMatrixEvent {
    const origId = replacedEventId(ev);
    if (!origId) return ev;
    const newContent = ev.content?.["m.new_content"];
    const content = newContent && typeof newContent === "object" ? { ...newContent } : { ...ev.content };
    delete (content as Record<string, unknown>)["m.relates_to"];
    return {
        ...ev,
        event_id: origId,
        content,
    };
}

/** True when the browser can hold a non-extractable AES-GCM key in IndexedDB. */
export function isWebEventIndexSupported(): boolean {
    return typeof crypto !== "undefined" && !!crypto.subtle && typeof indexedDB !== "undefined";
}

/**
 * Labs / config gate. Default off (`feature_web_event_index`).
 * CONFIG level is prioritised so deployments can force it on in config.json.
 */
export function isBrowserEventIndexEnabled(): boolean {
    if (!isWebEventIndexSupported()) return false;
    try {
        return Boolean(SettingsStore.getValue("feature_web_event_index"));
    } catch {
        return false;
    }
}

export async function deriveDek(pickleKey: string, salt: Uint8Array, userId: string, deviceId: string): Promise<CryptoKey> {
    const ikm = new TextEncoder().encode(pickleKey);
    const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
    ikm.fill(0);
    const info = new TextEncoder().encode(`${EVENTINDEX_HKDF_INFO}|${userId}|${deviceId}`);
    return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt, info },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}

export async function encryptJson(dek: CryptoKey, value: unknown, aad: string): Promise<EncryptedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(JSON.stringify(value));
    const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
        dek,
        pt,
    );
    pt.fill(0);
    return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptJson<T>(dek: CryptoKey, blob: EncryptedBlob, aad: string): Promise<T> {
    const iv = b64ToBytes(blob.iv);
    const ct = b64ToBytes(blob.ct);
    const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
        dek,
        ct,
    );
    const text = new TextDecoder().decode(pt);
    return JSON.parse(text) as T;
}

function checkpointKey(userId: string, cp: ICrawlerCheckpoint): string {
    return `${userId}|${cp.roomId}|${cp.token}|${cp.direction}`;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const factory = globalThis.indexedDB;
        if (!factory) {
            reject(new Error("IndexedDB not available"));
            return;
        }
        const req = factory.open(EVENTINDEX_DB_NAME, EVENTINDEX_DB_VERSION);
        req.onerror = (): void => reject(req.error ?? new Error("idb open failed"));
        req.onsuccess = (): void => resolve(req.result);
        req.onupgradeneeded = (): void => {
            const db = req.result;
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "userId" });
            }
            if (!db.objectStoreNames.contains("events")) {
                const events = db.createObjectStore("events", { keyPath: ["userId", "eventId"] });
                events.createIndex("byUser", "userId", { unique: false });
                events.createIndex("byUserRoom", ["userId", "roomId"], { unique: false });
            }
            if (!db.objectStoreNames.contains("checkpoints")) {
                const cps = db.createObjectStore("checkpoints", { keyPath: "id" });
                cps.createIndex("byUser", "userId", { unique: false });
            }
        };
    });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = (): void => resolve(req.result);
        req.onerror = (): void => reject(req.error ?? new Error("idb request failed"));
    });
}

function deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const factory = globalThis.indexedDB;
        if (!factory) {
            resolve();
            return;
        }
        const req = factory.deleteDatabase(EVENTINDEX_DB_NAME);
        req.onsuccess = (): void => resolve();
        req.onerror = (): void => reject(req.error ?? new Error("idb deleteDatabase failed"));
        req.onblocked = (): void => resolve();
    });
}

/**
 * Platform EventIndex manager. One instance per WebPlatform.
 *
 * In-memory inverted index for queries; AES-GCM records in IndexedDB for reload.
 * Key material lives only in this object (non-extractable CryptoKey) and is
 * derived from the pickle key, which Lifecycle destroys on logout.
 */
export class BrowserEventIndexManager extends BaseEventIndexManager {
    private userId: string | null = null;
    private deviceId: string | null = null;
    private dek: CryptoKey | null = null;
    private persistEnabled = false;
    private closed = true;

    private readonly events = new Map<string, StoredEvent>();
    private readonly inverted = new Map<string, Set<string>>();
    private readonly roomOrder = new Map<string, string[]>();
    private checkpoints: ICrawlerCheckpoint[] = [];
    private userVersion = 0;
    private ciphertextBytes = 0;

    private persistChain: Promise<void> = Promise.resolve();
    private db: IDBDatabase | null = null;

    public async supportsEventIndexing(): Promise<boolean> {
        return isBrowserEventIndexEnabled();
    }

    public async initEventIndex(userId: string, deviceId: string): Promise<void> {
        await this.resetMemory();
        this.userId = userId;
        this.deviceId = deviceId;
        this.closed = false;

        const pickleKey = await PlatformPeg.get()?.getPickleKey(userId, deviceId);
        let salt = crypto.getRandomValues(new Uint8Array(32));
        let existingMeta: MetaRecord | undefined;

        try {
            this.db = await openDb();
            existingMeta = await this.loadMeta(userId);
            if (existingMeta?.salt) {
                salt = b64ToBytes(existingMeta.salt);
                this.userVersion = existingMeta.userVersion ?? 0;
            }
        } catch (e) {
            log.warn("IndexedDB unavailable; index will be memory-only this session", e);
            this.db = null;
        }

        if (pickleKey) {
            this.dek = await deriveDek(pickleKey, salt, userId, deviceId);
            this.persistEnabled = this.db !== null;
        } else {
            // No pickle key: session-only DEK. Leftover ciphertext from a
            // previous session cannot be opened, which is the safety property.
            const ephemeral = crypto.getRandomValues(new Uint8Array(32));
            const baseKey = await crypto.subtle.importKey("raw", ephemeral, "HKDF", false, ["deriveKey"]);
            ephemeral.fill(0);
            this.dek = await crypto.subtle.deriveKey(
                {
                    name: "HKDF",
                    hash: "SHA-256",
                    salt,
                    info: new TextEncoder().encode(`${EVENTINDEX_HKDF_INFO}|session`),
                },
                baseKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"],
            );
            this.persistEnabled = false;
            log.info("EventIndex: no pickle key; index will not persist across reload");
        }

        if (this.persistEnabled && this.db && this.dek) {
            if (!existingMeta) {
                await this.saveMeta({
                    userId,
                    deviceId,
                    salt: bytesToB64(salt),
                    userVersion: this.userVersion,
                });
            }
            const loaded = await this.loadAllForUser(userId);
            if (!loaded) {
                log.warn("EventIndex: stored ciphertext could not be decrypted; wiping leftover for this user");
                await this.deleteUserRecords(userId);
                await this.saveMeta({
                    userId,
                    deviceId,
                    salt: bytesToB64(salt),
                    userVersion: 0,
                });
                this.userVersion = 0;
            }
        }
    }

    public async addEventToIndex(ev: IMatrixEvent, profile: IMatrixProfile): Promise<void> {
        if (this.closed || !this.userId) return;
        this.upsertEvent(ev, profile);
        this.schedulePersistEvent(this.targetId(ev));
    }

    public async deleteEvent(eventId: string): Promise<boolean> {
        if (this.closed) return false;
        const existed = this.events.has(eventId);
        this.removeFromIndex(eventId);
        if (existed && this.persistEnabled && this.db && this.userId) {
            const userId = this.userId;
            this.enqueuePersist(async () => {
                const tx = this.db!.transaction("events", "readwrite");
                tx.objectStore("events").delete([userId, eventId]);
                await txDone(tx);
            });
        }
        return existed;
    }

    public async isEventIndexEmpty(): Promise<boolean> {
        return this.events.size === 0;
    }

    public async isRoomIndexed(roomId: string): Promise<boolean> {
        const ids = this.roomOrder.get(roomId);
        return Boolean(ids && ids.length > 0);
    }

    public async getStats(): Promise<IIndexStats> {
        const rooms = new Set<string>();
        for (const ev of this.events.values()) rooms.add(ev.roomId);
        return {
            size: this.ciphertextBytes || this.estimatePlainSize(),
            eventCount: this.events.size,
            roomCount: rooms.size,
        };
    }

    public async getUserVersion(): Promise<number> {
        return this.userVersion;
    }

    public async setUserVersion(version: number): Promise<void> {
        this.userVersion = version;
        if (this.persistEnabled && this.db && this.userId) {
            const meta = await this.loadMeta(this.userId);
            if (meta) {
                meta.userVersion = version;
                await this.saveMeta(meta);
            }
        }
    }

    public async commitLiveEvents(): Promise<void> {
        await this.persistChain;
    }

    public async searchEventIndex(searchArgs: ISearchArgs): Promise<IResultRoomEvents> {
        const tokens = tokenize(searchArgs.search_term);
        const empty: IResultRoomEvents = { count: 0, results: [], highlights: tokens, next_batch: undefined };
        if (this.closed) return empty;

        let ids: Set<string> | null = tokens.length === 0 ? new Set() : null;
        for (const token of tokens) {
            const matches = this.lookupToken(token, token.length >= 2);
            if (ids === null) {
                ids = matches;
            } else {
                const next = new Set<string>();
                for (const id of ids) {
                    if (matches.has(id)) next.add(id);
                }
                ids = next;
            }
            if (ids.size === 0) break;
        }

        if (!ids || ids.size === 0) {
            ids = this.substringHits(searchArgs.search_term, searchArgs.room_id);
        }
        if (ids.size === 0) return empty;

        let hits = Array.from(ids!, (eventId) => this.events.get(eventId)).filter((e): e is StoredEvent => Boolean(e));
        if (searchArgs.room_id) {
            hits = hits.filter((e) => e.roomId === searchArgs.room_id);
        }

        if (searchArgs.order_by_recency) {
            hits.sort((a, b) => b.originServerTs - a.originServerTs);
        }

        const offset = searchArgs.next_batch ? Number.parseInt(searchArgs.next_batch, 10) || 0 : 0;
        const limit = Math.max(1, searchArgs.limit || 10);
        const page = hits.slice(offset, offset + limit);
        const next_batch = offset + page.length < hits.length ? String(offset + page.length) : undefined;

        const beforeLimit = Math.max(0, searchArgs.before_limit || 0);
        const afterLimit = Math.max(0, searchArgs.after_limit || 0);

        const results = page.map((hit, i) => {
            const context = this.contextFor(hit, beforeLimit, afterLimit);
            return {
                rank: 1 / (offset + i + 1),
                result: this.resultEvent(hit.event),
                context,
            };
        });

        return {
            count: hits.length,
            results,
            highlights: tokens,
            next_batch,
        };
    }

    public async addHistoricEvents(
        events: IEventAndProfile[],
        checkpoint: ICrawlerCheckpoint | null,
        oldCheckpoint: ICrawlerCheckpoint | null,
    ): Promise<boolean> {
        if (this.closed) return false;
        let allAlready = events.length > 0;
        for (const { event, profile } of events) {
            const id = this.targetId(event);
            const existing = this.events.get(id);
            const isReplace = replacedEventId(event) !== null;
            if (existing && !isReplace && existing.edited === false) {
                const incoming = effectiveEventForIndex(event);
                const nextText = extractSearchText(incoming);
                const nextFile = eventHasFile(incoming);
                if (nextText !== existing.searchText || nextFile !== existing.hasFile) {
                    this.unindexTokens(existing.eventId, existing.searchText);
                    existing.searchText = nextText;
                    existing.hasFile = nextFile;
                    existing.event = incoming;
                    this.indexTokens(existing.eventId, nextText);
                    this.schedulePersistEvent(id);
                    allAlready = false;
                }
                continue;
            }
            if (existing && !isReplace && existing.edited) {
                // Original arriving after an edit: keep new body.
                this.upsertEvent(event, profile);
                this.schedulePersistEvent(id);
                continue;
            }
            if (!existing) allAlready = false;
            else if (isReplace) allAlready = false;
            this.upsertEvent(event, profile);
            this.schedulePersistEvent(id);
        }
        if (oldCheckpoint) await this.removeCrawlerCheckpoint(oldCheckpoint);
        if (checkpoint) await this.addCrawlerCheckpoint(checkpoint);
        return allAlready;
    }

    public async addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        if (this.closed || !this.userId) return;
        const key = checkpointKey(this.userId, checkpoint);
        if (!this.checkpoints.some((c) => checkpointKey(this.userId!, c) === key)) {
            this.checkpoints.push(checkpoint);
        }
        await this.persistCheckpoint(checkpoint);
    }

    public async removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        if (!this.userId) return;
        const key = checkpointKey(this.userId, checkpoint);
        this.checkpoints = this.checkpoints.filter((c) => checkpointKey(this.userId!, c) !== key);
        if (this.persistEnabled && this.db) {
            const id = key;
            this.enqueuePersist(async () => {
                const tx = this.db!.transaction("checkpoints", "readwrite");
                tx.objectStore("checkpoints").delete(id);
                await txDone(tx);
            });
        }
    }

    public async loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
        return this.checkpoints.slice();
    }

    public async loadFileEvents(args: ILoadArgs): Promise<IEventAndProfile[]> {
        const ids = this.roomOrder.get(args.roomId) ?? [];
        const files: StoredEvent[] = [];
        for (const id of ids) {
            const ev = this.events.get(id);
            if (ev?.hasFile) files.push(ev);
        }
        files.sort((a, b) => a.originServerTs - b.originServerTs);
        const backwards = !args.direction || args.direction === "b";
        if (backwards) files.reverse();

        let start = 0;
        if (args.fromEvent) {
            const idx = files.findIndex((e) => e.eventId === args.fromEvent);
            start = idx >= 0 ? idx + 1 : 0;
        }
        return files.slice(start, start + Math.max(1, args.limit || 10)).map((e) => ({
            event: this.resultEvent(e.event),
            profile: e.profile,
        }));
    }

    public async closeEventIndex(): Promise<void> {
        try {
            await this.persistChain;
        } catch (e) {
            log.warn("EventIndex: flush on close failed", e);
        }
        this.dropKey();
        await this.resetMemory();
        this.closeDb();
        this.closed = true;
        this.persistEnabled = false;
        this.userId = null;
        this.deviceId = null;
    }

    public async deleteEventIndex(): Promise<void> {
        const userId = this.userId;
        this.dropKey();
        await this.resetMemory();
        this.closed = true;
        this.persistEnabled = false;
        try {
            if (userId && this.db) {
                await this.deleteUserRecords(userId);
            } else {
                this.closeDb();
                await deleteDatabase();
            }
        } catch (e) {
            log.warn("EventIndex: wipe failed; leftover ciphertext is inert without the pickle key", e);
            try {
                this.closeDb();
                await deleteDatabase();
            } catch (e2) {
                log.warn("EventIndex: database drop also failed", e2);
            }
        }
        this.closeDb();
        this.userId = null;
        this.deviceId = null;
    }

    private targetId(ev: IMatrixEvent): string {
        return replacedEventId(ev) ?? ev.event_id;
    }

    private upsertEvent(ev: IMatrixEvent, profile: IMatrixProfile): void {
        const origId = replacedEventId(ev);
        const targetId = origId ?? ev.event_id;
        if (!targetId || !ev.room_id) return;

        const existing = this.events.get(targetId);
        const incoming = effectiveEventForIndex(ev);

        if (existing && origId) {
            this.unindexTokens(existing.eventId, existing.searchText);
            existing.event = {
                ...existing.event,
                content: incoming.content,
            };
            existing.searchText = extractSearchText(existing.event);
            existing.edited = true;
            existing.profile = profile ?? existing.profile;
            existing.hasFile = eventHasFile(existing.event);
            this.indexTokens(existing.eventId, existing.searchText);
            return;
        }

        if (existing && !origId && existing.edited) {
            // Historic original after an edit: keep the new body, take envelope.
            existing.event = {
                ...incoming,
                content: existing.event.content,
            };
            existing.originServerTs = incoming.origin_server_ts ?? existing.originServerTs;
            existing.profile = profile ?? existing.profile;
            return;
        }

        if (existing && !origId) {
            return;
        }

        const stored: StoredEvent = {
            event: incoming,
            profile: profile ?? {},
            roomId: incoming.room_id,
            eventId: targetId,
            originServerTs: incoming.origin_server_ts ?? 0,
            searchText: extractSearchText(incoming),
            hasFile: eventHasFile(incoming),
            edited: Boolean(origId),
        };
        this.events.set(targetId, stored);
        this.indexTokens(targetId, stored.searchText);
        this.insertRoomOrder(stored);
    }

    private insertRoomOrder(stored: StoredEvent): void {
        let list = this.roomOrder.get(stored.roomId);
        if (!list) {
            list = [];
            this.roomOrder.set(stored.roomId, list);
        }
        if (list.includes(stored.eventId)) return;
        list.push(stored.eventId);
        list.sort((a, b) => {
            const ea = this.events.get(a);
            const eb = this.events.get(b);
            return (ea?.originServerTs ?? 0) - (eb?.originServerTs ?? 0);
        });
    }

    private removeFromIndex(eventId: string): void {
        const existing = this.events.get(eventId);
        if (!existing) return;
        this.unindexTokens(eventId, existing.searchText);
        this.events.delete(eventId);
        const list = this.roomOrder.get(existing.roomId);
        if (list) {
            const next = list.filter((id) => id !== eventId);
            if (next.length) this.roomOrder.set(existing.roomId, next);
            else this.roomOrder.delete(existing.roomId);
        }
    }

    private indexTokens(eventId: string, text: string): void {
        for (const token of tokenize(text)) {
            let set = this.inverted.get(token);
            if (!set) {
                set = new Set();
                this.inverted.set(token, set);
            }
            set.add(eventId);
        }
    }

    private unindexTokens(eventId: string, text: string): void {
        for (const token of tokenize(text)) {
            const set = this.inverted.get(token);
            if (!set) continue;
            set.delete(eventId);
            if (set.size === 0) this.inverted.delete(token);
        }
    }

    private substringHits(rawQuery: string, roomId?: string): Set<string> {
        const folded = foldText(rawQuery).replace(/\s+/g, " ").trim();
        const out = new Set<string>();
        if (folded.length < 3) return out;
        for (const ev of this.events.values()) {
            if (roomId && ev.roomId !== roomId) continue;
            if (foldText(ev.searchText).includes(folded)) out.add(ev.eventId);
        }
        return out;
    }

    private lookupToken(token: string, prefix: boolean): Set<string> {
        if (!prefix) return new Set(this.inverted.get(token) ?? []);
        const out = new Set<string>();
        const exact = this.inverted.get(token);
        if (exact) for (const id of exact) out.add(id);
        if (token.length >= 2) {
            for (const [idx, ids] of this.inverted) {
                if (idx !== token && idx.startsWith(token)) {
                    for (const id of ids) out.add(id);
                }
            }
        }
        return out;
    }

    private contextFor(
        hit: StoredEvent,
        beforeLimit: number,
        afterLimit: number,
    ): { events_before: IMatrixEvent[]; events_after: IMatrixEvent[]; profile_info: Record<string, IMatrixProfile> } {
        const list = this.roomOrder.get(hit.roomId) ?? [];
        const idx = list.indexOf(hit.eventId);
        const beforeIds = idx >= 0 ? list.slice(Math.max(0, idx - beforeLimit), idx) : [];
        const afterIds = idx >= 0 ? list.slice(idx + 1, idx + 1 + afterLimit) : [];
        const events_before = beforeIds.map((id) => this.resultEvent(this.events.get(id)!.event));
        const events_after = afterIds.map((id) => this.resultEvent(this.events.get(id)!.event));
        const profile_info: Record<string, IMatrixProfile> = {};
        const consider = [hit, ...beforeIds.map((id) => this.events.get(id)!), ...afterIds.map((id) => this.events.get(id)!)];
        for (const ev of consider) {
            if (ev.event.sender) profile_info[ev.event.sender] = ev.profile;
        }
        return { events_before, events_after, profile_info };
    }

    private resultEvent(ev: IMatrixEvent): IMatrixEvent {
        const copy = { ...ev } as IMatrixEvent & { state_key?: unknown };
        if (copy.state_key === null) delete copy.state_key;
        return copy;
    }

    private schedulePersistEvent(eventId: string): void {
        if (!this.persistEnabled || !this.dek || !this.db || !this.userId) return;
        const stored = this.events.get(eventId);
        if (!stored) return;
        const userId = this.userId;
        const dek = this.dek;
        this.enqueuePersist(async () => {
            const blob = await encryptJson(dek, stored, `${userId}|${eventId}`);
            this.ciphertextBytes += Math.ceil((blob.ct.length * 3) / 4);
            const rec: EventRecord = {
                userId,
                eventId,
                roomId: stored.roomId,
                ts: stored.originServerTs,
                hasFile: stored.hasFile ? 1 : 0,
                blob,
            };
            const tx = this.db!.transaction("events", "readwrite");
            tx.objectStore("events").put(rec);
            await txDone(tx);
        });
    }

    private async persistCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        if (!this.persistEnabled || !this.dek || !this.db || !this.userId) return;
        const userId = this.userId;
        const dek = this.dek;
        const id = checkpointKey(userId, checkpoint);
        this.enqueuePersist(async () => {
            const blob = await encryptJson(dek, checkpoint, `${userId}|cp|${id}`);
            const rec: CheckpointRecord = { id, userId, blob };
            const tx = this.db!.transaction("checkpoints", "readwrite");
            tx.objectStore("checkpoints").put(rec);
            await txDone(tx);
        });
    }

    private enqueuePersist(op: () => Promise<void>): void {
        this.persistChain = this.persistChain.then(op).catch((e) => {
            log.warn("EventIndex persist failed", e);
        });
    }

    private async loadMeta(userId: string): Promise<MetaRecord | undefined> {
        if (!this.db) return undefined;
        const tx = this.db.transaction("meta", "readonly");
        return idbReq(tx.objectStore("meta").get(userId));
    }

    private async saveMeta(meta: MetaRecord): Promise<void> {
        if (!this.db) return;
        const tx = this.db.transaction("meta", "readwrite");
        tx.objectStore("meta").put(meta);
        await txDone(tx);
    }

    /**
     * @returns false if any ciphertext failed to decrypt (caller should wipe).
     */
    private async loadAllForUser(userId: string): Promise<boolean> {
        if (!this.db || !this.dek) return true;
        const dek = this.dek;
        const evTx = this.db.transaction("events", "readonly");
        const evIdx = evTx.objectStore("events").index("byUser");
        const evRows = (await idbReq(evIdx.getAll(userId))) as EventRecord[];
        await txDone(evTx);

        this.ciphertextBytes = 0;
        for (const row of evRows) {
            try {
                const stored = await decryptJson<StoredEvent>(dek, row.blob, `${userId}|${row.eventId}`);
                this.events.set(stored.eventId, stored);
                this.indexTokens(stored.eventId, stored.searchText);
                this.insertRoomOrder(stored);
                this.ciphertextBytes += Math.ceil((row.blob.ct.length * 3) / 4);
            } catch {
                return false;
            }
        }

        const cpTx = this.db.transaction("checkpoints", "readonly");
        const cpIdx = cpTx.objectStore("checkpoints").index("byUser");
        const cpRows = (await idbReq(cpIdx.getAll(userId))) as CheckpointRecord[];
        await txDone(cpTx);
        this.checkpoints = [];
        for (const row of cpRows) {
            try {
                const cp = await decryptJson<ICrawlerCheckpoint>(dek, row.blob, `${userId}|cp|${row.id}`);
                this.checkpoints.push(cp);
            } catch {
                return false;
            }
        }
        return true;
    }

    private async deleteUserRecords(userId: string): Promise<void> {
        if (!this.db) return;
        const evTx = this.db.transaction("events", "readwrite");
        const evStore = evTx.objectStore("events");
        const evRows = (await idbReq(evStore.index("byUser").getAllKeys(userId))) as IDBValidKey[];
        for (const key of evRows) evStore.delete(key);
        await txDone(evTx);

        const cpTx = this.db.transaction("checkpoints", "readwrite");
        const cpStore = cpTx.objectStore("checkpoints");
        const cpRows = (await idbReq(cpStore.index("byUser").getAll(userId))) as CheckpointRecord[];
        for (const row of cpRows) cpStore.delete(row.id);
        await txDone(cpTx);

        const metaTx = this.db.transaction("meta", "readwrite");
        metaTx.objectStore("meta").delete(userId);
        await txDone(metaTx);
    }

    private estimatePlainSize(): number {
        let n = 0;
        for (const ev of this.events.values()) n += ev.searchText.length + 64;
        return n;
    }

    private dropKey(): void {
        this.dek = null;
    }

    private async resetMemory(): Promise<void> {
        this.events.clear();
        this.inverted.clear();
        this.roomOrder.clear();
        this.checkpoints = [];
        this.userVersion = 0;
        this.ciphertextBytes = 0;
        this.persistChain = Promise.resolve();
    }

    private closeDb(): void {
        try {
            this.db?.close();
        } catch {
            /* ignore */
        }
        this.db = null;
    }
}

function txDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = (): void => resolve();
        tx.onerror = (): void => reject(tx.error ?? new Error("idb tx failed"));
        tx.onabort = (): void => reject(tx.error ?? new Error("idb tx aborted"));
    });
}

export default BrowserEventIndexManager;
