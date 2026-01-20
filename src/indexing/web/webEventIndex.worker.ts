/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    ICrawlerCheckpoint,
    IEventAndProfile,
    IIndexStats,
    ILoadArgs,
    ISearchArgs,
} from "../BaseEventIndexManager";
import type { IEventWithRoomId, IMatrixProfile, IResultRoomEvents, ISearchResult } from "matrix-js-sdk/src/@types/search";

interface WorkerRequest {
    id: number;
    name: string;
    args: any[];
}

interface WorkerResponse {
    id: number;
    reply?: any;
    error?: string | { message: string };
}

interface EventRecord {
    event_id: string;
    room_id: string;
    sender?: string;
    origin_server_ts?: number;
    type?: string;
    msgtype?: string | null;
    body?: string;
    body_lower?: string;
    has_url?: boolean;
    event_json: string;
    profile_json?: string;
}

const ctx = self as any;

const DB_PREFIX = "element-web-event-index";
const DB_VERSION = 2;
const DEFAULT_MAX_EVENT_AGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TS = Number.MAX_SAFE_INTEGER;
const MAX_EVENT_ID = "\uffff";
// 单次搜索最多扫描的记录数，避免罕见关键词导致一次性遍历整个 IndexedDB 卡顿。
const MAX_SCAN_RECORDS = 2000;
const TEXT_MESSAGE_TYPES = new Set(["m.text", "m.notice", "m.emote"]);

let db: IDBDatabase | null = null;
let dbName: string | null = null;
let maxEventAgeMs = DEFAULT_MAX_EVENT_AGE_DAYS * DAY_MS;

function encodeKeyPart(value: string): string {
    return encodeURIComponent(value).replace(/%/g, "_");
}

function buildDbName(userId: string, deviceId: string): string {
    return `${DB_PREFIX}-${encodeKeyPart(userId)}-${encodeKeyPart(deviceId)}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
    });
}

function addRecord(store: IDBObjectStore, record: EventRecord): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const request = store.add(record);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => {
            if (request.error?.name === "ConstraintError") {
                event.preventDefault();
                resolve(false);
                return;
            }
            reject(request.error);
        };
    });
}

async function openDb(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, DB_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;

            if (database.objectStoreNames.contains("dbs")) {
                database.deleteObjectStore("dbs");
            }

            if (!database.objectStoreNames.contains("events")) {
                const store = database.createObjectStore("events", { keyPath: "event_id" });
                store.createIndex("room_id", "room_id", { unique: false });
                store.createIndex("room_ts", ["room_id", "origin_server_ts", "event_id"], { unique: false });
                store.createIndex(
                    "room_msgtype_ts",
                    ["room_id", "msgtype", "origin_server_ts", "event_id"],
                    { unique: false },
                );
            }

            if (!database.objectStoreNames.contains("checkpoints")) {
                database.createObjectStore("checkpoints", { keyPath: ["room_id", "token", "direction"] });
            }

            if (!database.objectStoreNames.contains("meta")) {
                database.createObjectStore("meta", { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function ensureDb(): IDBDatabase {
    if (!db) throw new Error("Event index not initialized");
    return db;
}

function getCutoffTs(): number {
    if (!maxEventAgeMs || maxEventAgeMs <= 0) return 0;
    return Date.now() - maxEventAgeMs;
}

async function setMaxEventAgeDays(days?: number): Promise<void> {
    if (typeof days !== "number" || !Number.isFinite(days)) return;
    if (days <= 0) {
        // 0/负数：不做“按时间淘汰”，允许索引任意历史（对齐 FluffyChat 的“按需拉取/无限回溯”体验）。
        maxEventAgeMs = 0;
        return;
    }
    maxEventAgeMs = Math.max(1, Math.floor(days)) * DAY_MS;
}

function isEventTooOld(ev: IEventWithRoomId, cutoffTs: number): boolean {
    if (!cutoffTs) return false;
    const ts = ev.origin_server_ts;
    if (typeof ts !== "number" || ts <= 0) return false;
    return ts < cutoffTs;
}

function extractBody(ev: IEventWithRoomId): string | null {
    if (ev.type !== "m.room.message") return null;
    const content = (ev as any).content ?? {};
    const msgtype = content.msgtype;
    if (typeof msgtype !== "string" || !TEXT_MESSAGE_TYPES.has(msgtype)) return null;
    return content.body ?? null;
}

function hasUrl(content: any): boolean {
    if (!content || typeof content !== "object") return false;
    if (content.url || content.file?.url) return true;
    if (content.info?.thumbnail_url || content.info?.thumbnail_file?.url) return true;
    return false;
}

async function supportsEventIndexing(): Promise<boolean> {
    return typeof indexedDB !== "undefined";
}

async function initEventIndex(userId: string, deviceId: string): Promise<void> {
    const name = buildDbName(userId, deviceId);
    if (db && dbName === name) return;
    db?.close();
    db = await openDb(name);
    dbName = name;
}

async function addEventToIndex(ev: IEventWithRoomId, profile: IMatrixProfile): Promise<void> {
    if (!ev.event_id) return;
    const cutoffTs = getCutoffTs();
    if (isEventTooOld(ev, cutoffTs)) return;

    const database = ensureDb();
    const tx = database.transaction("events", "readwrite");
    const store = tx.objectStore("events");

    const content = (ev as any).content ?? {};
    const msgtype = ev.type === "m.room.message" ? content.msgtype ?? null : null;
    const body = extractBody(ev) ?? "";

    await addRecord(store, {
        event_id: ev.event_id,
        room_id: ev.room_id,
        sender: ev.sender,
        origin_server_ts: ev.origin_server_ts ?? 0,
        type: ev.type,
        msgtype,
        body,
        body_lower: body.toLowerCase(),
        has_url: hasUrl(content),
        event_json: JSON.stringify(ev),
        profile_json: JSON.stringify(profile ?? {}),
    });

    await transactionDone(tx);
}

async function deleteEvent(eventId: string): Promise<boolean> {
    const database = ensureDb();
    const tx = database.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    store.delete(eventId);
    await transactionDone(tx);
    return true;
}

async function isEventIndexEmpty(): Promise<boolean> {
    const database = ensureDb();
    const tx = database.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const count = await requestToPromise(store.count());
    await transactionDone(tx);
    return count === 0;
}

async function isRoomIndexed(roomId: string): Promise<boolean> {
    const database = ensureDb();
    const tx = database.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const index = store.index("room_id");
    const count = await requestToPromise(index.count(IDBKeyRange.only(roomId)));
    await transactionDone(tx);
    return count > 0;
}

async function commitLiveEvents(): Promise<void> {
    return;
}

function parseNextBatch(nextBatch?: string): { key?: IDBValidKey; count?: number; exhausted?: boolean } {
    if (!nextBatch) return {};
    try {
        const parsed = JSON.parse(nextBatch);
        if (parsed && typeof parsed === "object") {
            // 兼容 { key, count, exhausted } 以及“仅 metadata 不带 key”的情况（例如本地索引为空时）。
            return {
                key: (parsed as any).key as IDBValidKey | undefined,
                count: (parsed as any).count as number | undefined,
                exhausted: Boolean((parsed as any).exhausted),
            };
        }
        return { key: parsed as IDBValidKey };
    } catch {
        return {};
    }
}

function buildRoomRange(roomId: string, startKey?: IDBValidKey, direction: "prev" | "next" = "prev"): IDBKeyRange {
    const lower = [roomId, 0, ""] as IDBValidKey;
    const upper = [roomId, MAX_TS, MAX_EVENT_ID] as IDBValidKey;
    if (!startKey) return IDBKeyRange.bound(lower, upper);
    if (direction === "prev") {
        return IDBKeyRange.bound(lower, startKey, false, true);
    }
    return IDBKeyRange.bound(startKey, upper, true, false);
}

async function fetchEvents(
    roomId: string,
    range: IDBKeyRange,
    direction: IDBCursorDirection,
    limit: number,
): Promise<Array<{ event: IEventWithRoomId; profile: IMatrixProfile }>> {
    const database = ensureDb();
    const tx = database.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const index = store.index("room_ts");
    const results: Array<{ event: IEventWithRoomId; profile: IMatrixProfile }> = [];

    await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range, direction);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || results.length >= limit) {
                resolve();
                return;
            }
            const record = cursor.value as EventRecord;
            const event = JSON.parse(record.event_json) as IEventWithRoomId;
            const profile = record.profile_json ? (JSON.parse(record.profile_json) as IMatrixProfile) : {};
            results.push({ event, profile });
            cursor.continue();
        };
    });

    await transactionDone(tx);
    return results;
}

async function buildContext(
    event: IEventWithRoomId,
    profile: IMatrixProfile,
    beforeLimit: number,
    afterLimit: number,
): Promise<{ events_before: IEventWithRoomId[]; events_after: IEventWithRoomId[]; profile_info: Record<string, IMatrixProfile> }> {
    const roomId = event.room_id;
    const ts = event.origin_server_ts ?? 0;
    const eventId = event.event_id;

    const beforeRange = IDBKeyRange.bound([roomId, 0, ""], [roomId, ts, eventId], false, true);
    const afterRange = IDBKeyRange.bound([roomId, ts, eventId], [roomId, MAX_TS, MAX_EVENT_ID], true, false);

    const before = beforeLimit > 0 ? await fetchEvents(roomId, beforeRange, "prev", beforeLimit) : [];
    const after = afterLimit > 0 ? await fetchEvents(roomId, afterRange, "next", afterLimit) : [];

    const profileInfo: Record<string, IMatrixProfile> = {};
    const all = [...before, { event, profile }, ...after];
    for (const item of all) {
        const sender = item.event.sender;
        if (!sender) continue;
        if (Object.keys(item.profile || {}).length > 0) {
            profileInfo[sender] = item.profile;
        }
    }

    return {
        events_before: before.map((item) => item.event),
        events_after: after.map((item) => item.event),
        profile_info: profileInfo,
    };
}

async function scanRoomForMatches(
    roomId: string,
    termLower: string,
    limit: number,
    startKey?: IDBValidKey,
): Promise<{ records: EventRecord[]; nextKey?: IDBValidKey; exhausted: boolean }> {
    const database = ensureDb();
    const tx = database.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const index = store.index("room_ts");
    const range = buildRoomRange(roomId, startKey, "prev");

    const records: EventRecord[] = [];
    let nextKey: IDBValidKey | undefined;
    let lastKey: IDBValidKey | undefined;
    let exhausted = false;
    let scanned = 0;
    let resolved = false;

    await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range, "prev");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            if (resolved) return;
            const cursor = request.result;
            if (!cursor) {
                exhausted = true;
                // 记录已扫描到的最老事件 key，便于在 backfill 后继续向更老历史推进。
                if (lastKey) nextKey = lastKey;
                else if (startKey) nextKey = startKey;
                resolved = true;
                resolve();
                return;
            }
            scanned += 1;
            lastKey = cursor.key as IDBValidKey;
            const record = cursor.value as EventRecord;
            // 仅把“文本消息”纳入搜索结果，避免房间名/主题/文件名等噪音干扰（对齐 FluffyChat 体验）。
            if (record.type !== "m.room.message" || !TEXT_MESSAGE_TYPES.has(record.msgtype ?? "")) {
                if (scanned >= MAX_SCAN_RECORDS) {
                    nextKey = cursor.key as IDBValidKey;
                    resolved = true;
                    resolve();
                    return;
                }
                cursor.continue();
                return;
            }
            const bodyLower = record.body_lower ?? "";
            if (bodyLower.includes(termLower)) {
                records.push(record);
                if (records.length >= limit) {
                    nextKey = cursor.key as IDBValidKey;
                    resolved = true;
                    resolve();
                    return;
                }
            }
            if (scanned >= MAX_SCAN_RECORDS) {
                nextKey = cursor.key as IDBValidKey;
                resolved = true;
                resolve();
                return;
            }
            cursor.continue();
        };
    });

    await transactionDone(tx);
    return { records, nextKey, exhausted };
}

async function searchEventIndex(searchArgs: ISearchArgs): Promise<IResultRoomEvents> {
    const roomId = searchArgs.room_id;
    if (!roomId) {
        return { results: [], highlights: [], count: 0 };
    }

    const term = searchArgs.search_term?.trim() ?? "";
    if (!term) {
        return { results: [], highlights: [], count: 0 };
    }

    const limit = searchArgs.limit ?? 10;
    const beforeLimit = searchArgs.before_limit ?? 1;
    const afterLimit = searchArgs.after_limit ?? 1;
    const { key: startKey, count: baseCount } = parseNextBatch(searchArgs.next_batch);

    const { records, nextKey, exhausted } = await scanRoomForMatches(roomId, term.toLowerCase(), limit, startKey);

    const results: ISearchResult[] = [];
    for (const record of records) {
        const event = JSON.parse(record.event_json) as IEventWithRoomId;
        const profile = record.profile_json ? (JSON.parse(record.profile_json) as IMatrixProfile) : {};
        const context = await buildContext(event, profile, beforeLimit, afterLimit);
        if (event.sender && Object.keys(profile).length > 0) {
            context.profile_info[event.sender] = profile;
        }
        results.push({
            rank: 0,
            result: event,
            context,
        });
    }

    const totalCount = (typeof baseCount === "number" ? baseCount : 0) + results.length;

    return {
        count: totalCount,
        highlights: [term],
        results,
        // 始终返回包含 exhausted 的 next_batch（即使没有 key），让上层能判断是否需要 backfill。
        next_batch: JSON.stringify({ key: nextKey, count: totalCount, exhausted }),
    };
}

async function addHistoricEvents(
    events: IEventAndProfile[],
    checkpoint: ICrawlerCheckpoint | null,
    oldCheckpoint: ICrawlerCheckpoint | null,
): Promise<boolean> {
    const cutoffTs = getCutoffTs();
    const database = ensureDb();
    const tx = database.transaction(["events", "checkpoints"], "readwrite");
    const eventsStore = tx.objectStore("events");
    const checkpointsStore = tx.objectStore("checkpoints");

    const insertPromises: Array<Promise<boolean>> = [];
    for (const item of events) {
        if (!item.event.event_id) continue;
        if (isEventTooOld(item.event, cutoffTs)) continue;
        const content = (item.event as any).content ?? {};
        const msgtype = item.event.type === "m.room.message" ? content.msgtype ?? null : null;
        const body = extractBody(item.event) ?? "";
        insertPromises.push(
            addRecord(eventsStore, {
                event_id: item.event.event_id,
                room_id: item.event.room_id,
                sender: item.event.sender,
                origin_server_ts: item.event.origin_server_ts ?? 0,
                type: item.event.type,
                msgtype,
                body,
                body_lower: body.toLowerCase(),
                has_url: hasUrl(content),
                event_json: JSON.stringify(item.event),
                profile_json: JSON.stringify(item.profile ?? {}),
            }),
        );
    }

    if (oldCheckpoint) {
        checkpointsStore.delete([oldCheckpoint.roomId, oldCheckpoint.token, oldCheckpoint.direction] as IDBValidKey);
    }

    if (checkpoint) {
        checkpointsStore.put({
            room_id: checkpoint.roomId,
            token: checkpoint.token,
            direction: checkpoint.direction,
            full_crawl: checkpoint.fullCrawl ? 1 : 0,
        });
    }

    const insertResults = await Promise.all(insertPromises);
    const inserted = insertResults.filter(Boolean).length;

    await transactionDone(tx);
    return inserted === 0;
}

async function addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
    const database = ensureDb();
    const tx = database.transaction("checkpoints", "readwrite");
    const store = tx.objectStore("checkpoints");
    store.put({
        room_id: checkpoint.roomId,
        token: checkpoint.token,
        direction: checkpoint.direction,
        full_crawl: checkpoint.fullCrawl ? 1 : 0,
    });
    await transactionDone(tx);
}

async function removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
    const database = ensureDb();
    const tx = database.transaction("checkpoints", "readwrite");
    const store = tx.objectStore("checkpoints");
    store.delete([checkpoint.roomId, checkpoint.token, checkpoint.direction] as IDBValidKey);
    await transactionDone(tx);
}

async function loadFileEvents(args: ILoadArgs): Promise<IEventAndProfile[]> {
    const roomId = args.roomId;
    const limit = args.limit ?? 10;
    const direction = args.direction ?? "b";

    let startKey: IDBValidKey | undefined;
    if (args.fromEvent) {
        const database = ensureDb();
        const tx = database.transaction("events", "readonly");
        const store = tx.objectStore("events");
        const record = await requestToPromise(store.get(args.fromEvent));
        await transactionDone(tx);
        if (record) startKey = [record.room_id, record.origin_server_ts ?? 0, record.event_id] as IDBValidKey;
    }

    const database = ensureDb();
    const tx = database.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const cursorDirection: IDBCursorDirection = direction === "b" ? "prev" : "next";
    const range = buildRoomRange(roomId, startKey, cursorDirection === "prev" ? "prev" : "next");
    const msgtypes = new Set(["m.file", "m.image", "m.video", "m.audio"]);
    const results: IEventAndProfile[] = [];

    const index = store.index("room_ts");
    await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(range, cursorDirection);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || results.length >= limit) {
                resolve();
                return;
            }
            const record = cursor.value as EventRecord;
            if (msgtypes.has(record.msgtype ?? "")) {
                results.push({
                    event: JSON.parse(record.event_json) as IEventWithRoomId,
                    profile: record.profile_json ? (JSON.parse(record.profile_json) as IMatrixProfile) : {},
                });
            }
            cursor.continue();
        };
    });

    await transactionDone(tx);
    return results;
}

async function loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
    const database = ensureDb();
    const tx = database.transaction("checkpoints", "readonly");
    const store = tx.objectStore("checkpoints");
    const results = await requestToPromise(store.getAll());
    await transactionDone(tx);

    return (results as Array<{ room_id: string; token: string; direction: string; full_crawl?: number }>).map(
        (row) => ({
            roomId: row.room_id,
            token: row.token,
            direction: row.direction as any,
            fullCrawl: row.full_crawl === 1,
        }),
    );
}

async function closeEventIndex(): Promise<void> {
    db?.close();
    db = null;
}

async function getStats(): Promise<IIndexStats> {
    const database = ensureDb();
    const countTx = database.transaction("events", "readonly");
    const countStore = countTx.objectStore("events");
    const count = await requestToPromise(countStore.count());
    await transactionDone(countTx);

    let roomCount = 0;
    const roomTx = database.transaction("events", "readonly");
    const roomStore = roomTx.objectStore("events");
    const index = roomStore.index("room_id");
    await new Promise<void>((resolve, reject) => {
        const request = index.openKeyCursor(null, "nextunique");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                resolve();
                return;
            }
            roomCount += 1;
            cursor.continue();
        };
    });

    await transactionDone(roomTx);

    return {
        size: 0,
        eventCount: count,
        roomCount,
    };
}

async function getUserVersion(): Promise<number> {
    const database = ensureDb();
    const tx = database.transaction("meta", "readonly");
    const store = tx.objectStore("meta");
    const row = await requestToPromise(store.get("user_version"));
    await transactionDone(tx);
    return row?.value ?? 0;
}

async function setUserVersion(version: number): Promise<void> {
    const database = ensureDb();
    const tx = database.transaction("meta", "readwrite");
    const store = tx.objectStore("meta");
    store.put({ key: "user_version", value: version });
    await transactionDone(tx);
}

async function deleteEventIndex(): Promise<void> {
    db?.close();
    db = null;

    if (!dbName) return;

    await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName!);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();
    });
    dbName = null;
}

const handlers: Record<string, (...args: any[]) => Promise<any>> = {
    supportsEventIndexing,
    initEventIndex,
    setMaxEventAgeDays,
    addEventToIndex,
    deleteEvent,
    isEventIndexEmpty,
    isRoomIndexed,
    commitLiveEvents,
    searchEventIndex,
    addHistoricEvents,
    addCrawlerCheckpoint,
    removeCrawlerCheckpoint,
    loadFileEvents,
    loadCheckpoints,
    closeEventIndex,
    getStats,
    getUserVersion,
    setUserVersion,
    deleteEventIndex,
};

ctx.onmessage = async (event: MessageEvent<WorkerRequest>): Promise<void> => {
    const { id, name, args } = event.data;
    const handler = handlers[name];
    if (!handler) {
        ctx.postMessage({ id, error: `Unknown handler: ${name}` } as WorkerResponse);
        return;
    }
    try {
        const reply = await handler(...args);
        ctx.postMessage({ id, reply } as WorkerResponse);
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        ctx.postMessage({ id, error } as WorkerResponse);
    }
};
