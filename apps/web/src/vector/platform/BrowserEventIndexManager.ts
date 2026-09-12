/*
Copyright 2026 inblock.io

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Browser EventIndex backend for Element Web. Implements {@link BaseEventIndexManager} so that the stock Search UX --
 * served on Desktop by Seshat, a native Rust/Tantivy index -- also works in the browser, where encrypted rooms cannot
 * be searched server side. This is not a port of Seshat: the query engine is a plain in-memory inverted index over
 * whitespace-ish tokens, and the durable state is a set of AES-GCM records in a dedicated IndexedDB database, decrypted
 * in full at startup.
 *
 * ## Threat model
 *
 * The DEK is derived with HKDF-SHA256 from the session pickle key, whose own ciphertext and wrapping key live in the
 * *same origin's* IndexedDB (`apps/web/src/utils/tokens/pickling.ts`). So an attacker who exfiltrates **only** the
 * `element-eventindex` database learns nothing about message content, only the metadata below; one with the **whole
 * browser profile** can re-derive the DEK and read everything, which is the assumption Element already makes for access
 * tokens; and it buys **nothing** against XSS in this origin, where script can ask the platform for the pickle key or
 * read the already-decrypted in-memory index.
 *
 * ### What is still cleartext on disk
 *
 * - `events`: the record key `[userId, eventId]` and the `byUser` index over `userId`. Note what a cleartext `eventId`
 *   implies, because it bounds the whole database: Matrix event ids are globally unique identifiers the server
 *   assigned, so the homeserver -- or any member of the room -- can map any of them straight back to its room. **The
 *   database as a whole therefore does disclose which rooms are indexed**, to exactly the class of attacker the
 *   checkpoint HMAC defends against.
 * - `checkpoints`: the `userId` column and its `byUser` index. The record key is an HMAC of the checkpoint tuple
 *   ({@link checkpointKey}), so no room id, token or direction is on disk in the clear. Given the point above, keying
 *   still buys two things: a room with a crawl checkpoint but no indexed events yet is not disclosed at all, and a
 *   guessed room id cannot be confirmed offline by hashing it. What it does disclose is **equality and count**.
 * - `meta`: `userId`, the HKDF `salt` and `userVersion`. The salt is not secret by construction.
 * - Shape: the number of records approximates the number of indexed events, and each ciphertext length the size of the
 *   event it holds.
 *
 * Every record is additionally bound by AAD to its own key, so an attacker with write access cannot re-file a record
 * under another user or event id and have it decrypt -- though that is no defence against deleting records or rolling
 * the database back. And all of this is strictly about data **at rest**: once {@link
 * BrowserEventIndexManager.initEventIndex} has run, the whole index is held decrypted in memory for the session.
 */

import { logger } from "matrix-js-sdk/src/logger";
import {
    decodeBase64,
    encodeBase64,
    type IMatrixProfile,
    type IEventWithRoomId as IMatrixEvent,
    type IResultRoomEvents,
} from "matrix-js-sdk/src/matrix";
import sanitizeHtml from "sanitize-html";

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

/**
 * Name of the IndexedDB database holding the index. Deliberately its own database, neither the rust crypto store nor
 * `matrix-react-sdk` (which holds the pickle key), so that {@link deleteDisabledEventIndexDb} and {@link
 * BrowserEventIndexManager.deleteEventIndex} can drop it without risking unrelated data.
 */
const EVENTINDEX_DB_NAME = "element-eventindex";
/**
 * v2 closed three metadata leaks at once: the unread plaintext `roomId`/`ts`/`hasFile` columns and `byUserRoom` index
 * on `events`, the unread `deviceId` column on `meta`, and the `checkpoints` primary key, which was the cleartext tuple
 * and is now an HMAC of it. See {@link migrateV1ToV2}, which resets the index rather than converting it.
 */
const EVENTINDEX_DB_VERSION = 2;

/**
 * HKDF `info` prefix for the data encryption key, domain-separating it from anything else derivable from the same
 * pickle key; the user and device ids are appended per derivation ({@link deriveDek}). The trailing `v1` versions the
 * *derivation*, not the schema, so changing it makes every existing record undecryptable -- which {@link
 * BrowserEventIndexManager.initEventIndex} handles by wiping and re-crawling.
 */
const EVENTINDEX_HKDF_INFO = "element-eventindex-v1";

/**
 * HKDF `info` prefix for the subkey that names checkpoint records ({@link deriveCheckpointMacKey}). Deliberately
 * different from {@link EVENTINDEX_HKDF_INFO}: the key that names records must never be the key that encrypts them, and
 * HKDF gives independent outputs only for distinct `info`. The two differ before their first `|`, so no user or device
 * id can make them collide.
 */
const EVENTINDEX_CPMAC_HKDF_INFO = "element-eventindex-cpmac-v1";

/**
 * One indexed event, in memory and inside the ciphertext of an {@link EventRecord}. Everything the search path needs is
 * precomputed here, because a query must not re-parse event content on every keystroke.
 */
interface StoredEvent {
    /**
     * The event as handed back in search results (through {@link resultEvent}, which copies it). For an edited message
     * this carries the replacement content under the original's envelope once both have been seen, and `event_id` is
     * always the original's; see {@link effectiveEventForIndex}.
     */
    event: IMatrixEvent;
    /** Sender display name and avatar as of the time the event was seen, for rendering results without a room. */
    profile: IMatrixProfile;
    /** Denormalised `event.room_id`, used by the room filter and by {@link BrowserEventIndexManager.contextFor}. */
    roomId: string;
    /** The id this record is filed under: always the *original* event's id, never an edit's. */
    eventId: string;
    /** Denormalised `event.origin_server_ts`, defaulting to 0. Drives recency ordering. */
    originServerTs: number;
    /** The concatenated searchable text extracted by {@link extractSearchText}; the input to tokenisation. */
    searchText: string;
    /** Whether this event carries an `mxc://` attachment, so {@link BrowserEventIndexManager.loadFileEvents} can answer without re-inspecting content. */
    hasFile: boolean;
    /** True once an m.replace has been applied. Later originals must not revert the body. */
    edited: boolean;
    /**
     * Ids of the m.replace events whose content was folded into this record. A redaction names the edit's own id, so
     * this is what maps it back to the record to remove.
     */
    editIds?: string[];
}

/**
 * An AES-GCM ciphertext as stored in IndexedDB. Both halves are base64 rather than the `Uint8Array`s the crypto API
 * deals in, which buys nothing at rest but keeps the stored record plain JSON, comparable and assertable in tests
 * without caring how an engine round-trips buffers.
 */
interface EncryptedBlob {
    /** Base64 of the 12-byte random IV used for this one encryption. */
    iv: string;
    /** Base64 of the ciphertext, GCM tag included. */
    ct: string;
}

/**
 * The single per-user bookkeeping row, in the `meta` store. Entirely cleartext, and must stay that way: {@link
 * BrowserEventIndexManager.initEventIndex} has to read the salt *before* it can derive the key that would decrypt
 * anything.
 */
interface MetaRecord {
    /** Owning user, and the record key. */
    userId: string;
    /** Base64 of the 32-byte HKDF salt. Not secret; its job is to make the derivation unique per index, not to hide anything. */
    salt: string;
    /** Schema version owned by the caller (EventIndex), not by this file. See {@link BrowserEventIndexManager.setUserVersion}. */
    userVersion: number;
}

/**
 * A stored event. `userId` and `eventId` are the record key, and `eventId` is bound into the AAD, so they are
 * necessarily cleartext; everything else lives in `blob` and must never be duplicated out here.
 */
interface EventRecord {
    userId: string;
    eventId: string;
    blob: EncryptedBlob;
}

/**
 * A crawler checkpoint at rest. `id` is {@link checkpointKey}: the primary key and part of the AAD, disclosing no room
 * id, token or direction. Its determinism is what lets {@link BrowserEventIndexManager.removeCrawlerCheckpoint} address
 * a record, and is also the residual equality/count leak in the threat model above.
 */
interface CheckpointRecord {
    id: string;
    userId: string;
    blob: EncryptedBlob;
}

/**
 * Normalise text for matching: lowercase, NFKD-decompose, drop combining marks, so `cafe` and its accented and
 * full-width spellings fold together. Applied both when indexing (via {@link tokenize}) and when querying -- the only
 * reason a stored term and a typed term can compare equal -- so it must stay a pure function of its input.
 */
function foldText(text: string): string {
    return text
        .toLocaleLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}+/gu, "");
}

/**
 * Split text into the terms this index stores and queries: fold it ({@link foldText}), then break on every run of
 * characters that is not a letter, a number or an underscore, which keeps punctuation, markdown syntax and URL
 * separators off the words around them. Deliberately language-unaware, so a query in a script that does not separate
 * words collapses to one long token matching nothing -- one of the cases {@link BrowserEventIndexManager.substringHits}
 * exists to catch.
 *
 * @knipignore - exported for tests
 */
export function tokenize(text: string): string[] {
    if (!text) return [];
    return foldText(text)
        .split(/[^\p{L}\p{N}_]+/u)
        .filter((t) => t.length > 0);
}

/**
 * The id of the event that `ev` edits, or `null` if it is not an edit or the relation is malformed. This index files an
 * edit under the *original* message's id ({@link effectiveEventForIndex}), so nearly every write path begins by asking
 * this.
 * @knipignore - exported for tests
 */
export function replacedEventId(ev: IMatrixEvent): string | null {
    const rel = ev.content?.["m.relates_to"];
    if (rel && rel.rel_type === "m.replace" && typeof rel.event_id === "string" && rel.event_id.length > 0) {
        return rel.event_id;
    }
    return null;
}

/**
 * Strip the markup from an event's `formatted_body` (untrusted HTML) down to its text, for indexing. The result is only
 * ever tokenised; it is not safe to render, and nothing renders it. `sanitize-html` drops tags without leaving anything
 * in their place, so `<p>foo</p><p>bar</p>` would run together into the bogus token `foobar`. A separator is supplied
 * by putting a space before every `<` in the *input*, which cannot change how the markup parses: inside a quoted
 * attribute value it is one more character of a discarded value, and everywhere else `<` already begins a tag or is
 * already text. Doing it through `textFilter` looks equivalent and is not -- the parser emits a decoded entity as its
 * own text node, so a space landed mid-word (`AT&amp;T` became `AT & T`). The sanitiser re-escapes what it emits, so
 * its three entities are decoded again in a single pass.
 */
function stripHtml(s: string): string {
    const stripped = sanitizeHtml(s.replace(/</g, " <"), { allowedTags: [] });
    return stripped.replace(/&(lt|gt|amp);/g, (_match, entity) =>
        entity === "lt" ? "<" : entity === "gt" ? ">" : "&",
    );
}

/**
 * Walk a piece of event content and collect every human-readable string it contains into `into`. Recursive because
 * extensible-event content nests, and both stable `m.*` and unstable `org.matrix.msc1767.*` names are read. Anything
 * that is not a string or object is ignored rather than stringified, so structural data and identifiers cannot leak
 * into the search text.
 */
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

/**
 * Everything in an event a user could plausibly search for, concatenated into {@link StoredEvent.searchText} once on
 * the way in, because a query runs against every indexed event. `m.room.name` and `m.room.topic` are special-cased to
 * their one meaningful field, their content having no `body`; `m.new_content` is collected *in addition to* the
 * top-level content, so a malformed edit still contributes its fallback body.
 *
 * @returns The strings joined by single spaces, or `""` when there is no text at all -- which tokenises to no terms, so
 *     such an event is still returned as search *context* but never matches a term query.
 * @knipignore - exported for tests
 */
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

/**
 * Whether an event carries an attachment: an `mxc://` URL at `content.url` or `content.file.url`. Denormalised into
 * {@link StoredEvent.hasFile} so the file panel need not re-inspect content per event. The scheme is checked rather
 * than mere presence, so an `http://` value planted by a hostile sender cannot masquerade as an attachment.
 * @knipignore - exported for tests
 */
export function eventHasFile(ev: IMatrixEvent): boolean {
    const url = ev.content?.url ?? ev.content?.file?.url;
    return typeof url === "string" && url.startsWith("mxc://");
}

/**
 * The event as it should be indexed: for an edit, the replacement content re-attached to the *original* event's id; for
 * anything else, `ev` itself. Filing an edit under its own id would mean a search for text the user can see returns an
 * event no timeline renders and no permalink resolves. `m.new_content` is preferred, falling back to the edit's own
 * content; `m.relates_to` is dropped from the copy, or the stored event would look like an edit to every later reader.
 *
 * @returns For a non-edit, `ev` by reference, so callers must not mutate it. For an edit, a new object carrying the
 *     *edit's* envelope and the original's `event_id` -- which is why a record indexed edit-first holds the edit's
 *     timestamp until the original arrives.
 * @knipignore - exported for tests
 */
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

/**
 * Whether this browser can run the index at all: WebCrypto for the key derivation and AES-GCM, IndexedDB for the
 * records and for the pickle key upstream. Checked before the labs flag, so an unsupported browser reports the feature
 * unavailable rather than failing later. Presence is not permission, though: IndexedDB can still refuse to open, which
 * {@link BrowserEventIndexManager.initEventIndex} handles by falling back to memory-only.
 *
 * @knipignore - exported for tests
 */
export function isWebEventIndexSupported(): boolean {
    return typeof crypto !== "undefined" && !!crypto.subtle && typeof indexedDB !== "undefined";
}

/**
 * The single gate on the whole feature: platform support *and* the `feature_web_event_index` labs flag, which defaults
 * to off. Declared with `LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED` (`apps/web/src/settings/Settings.tsx`),
 * so a deployment can turn it on from `config.json` and it is otherwise a per-device choice. It runs once per live
 * event through {@link BrowserEventIndexManager.featureEnabled}, so it must stay cheap and must never throw: a settings
 * read that fails is treated as "off".
 */
export function isBrowserEventIndexEnabled(): boolean {
    if (!isWebEventIndexSupported()) return false;
    try {
        return Boolean(SettingsStore.getValue("feature_web_event_index"));
    } catch {
        return false;
    }
}

/**
 * Derive the AES-GCM data encryption key protecting one user's index on one device: HKDF-SHA256 over the session pickle
 * key, salted with the per-index {@link MetaRecord.salt} and domain-separated by an `info` of
 * `${EVENTINDEX_HKDF_INFO}|${userId}|${deviceId}`. Binding both ids means a second account, or the same account on a
 * second device, derives an unrelated key from the same root. **Why the base64 *string* is hashed, not the bytes it
 * encodes.** `pickleKey` is fed to HKDF as its ASCII characters, deliberately not decoded first, and this is safe: it
 * is `encodeUnpaddedBase64` of 32 bytes from `crypto.getRandomValues` (`createPickleKey` in
 * `apps/web/src/BasePlatform.ts`), base64 is injective, so those 43 characters carry all 256 bits of entropy, and
 * HKDF-Extract accepts keying material of any length and encoding. Decoding first would be equally sound but would
 * derive a *different* key, orphaning every record already written. `ikm` is zeroed once WebCrypto has copied it --
 * best effort only, `pickleKey` being a JavaScript string whose immutable copy of the secret remains on the heap.
 *
 * @param deviceId - Mixed into `info`, so a re-login under a new device id orphans the old records; {@link
 *     BrowserEventIndexManager.initEventIndex} then wipes and re-crawls, which is the intended outcome.
 */
export async function deriveDek(
    pickleKey: string,
    salt: Uint8Array<ArrayBuffer>,
    userId: string,
    deviceId: string,
): Promise<CryptoKey> {
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

/**
 * Derive the HMAC-SHA256 subkey that names checkpoint records. Same HKDF root, salt and per-user/per-device binding as
 * {@link deriveDek} -- including the point about `pickleKey` being hashed as base64 text -- but a different `info` and
 * algorithm, so this key is independent of the DEK and can only sign.
 * @knipignore - exported for tests
 */
export async function deriveCheckpointMacKey(
    pickleKey: string,
    salt: Uint8Array<ArrayBuffer>,
    userId: string,
    deviceId: string,
): Promise<CryptoKey> {
    const ikm = new TextEncoder().encode(pickleKey);
    const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey"]);
    ikm.fill(0);
    const info = new TextEncoder().encode(`${EVENTINDEX_CPMAC_HKDF_INFO}|${userId}|${deviceId}`);
    return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt, info },
        baseKey,
        { name: "HMAC", hash: "SHA-256", length: 256 },
        false,
        ["sign"],
    );
}

/**
 * Serialise a value and encrypt it as AES-GCM, ready to store as an {@link EncryptedBlob}. A fresh 12-byte IV from the
 * CSPRNG on every call. 96 bits is the length GCM is specified around, so it is used directly as the counter block
 * without the extra GHASH pass any other length needs. Random rather than a counter because there is no durable place
 * to keep a counter that a wiped, restored or rolled-back database could not silently reset -- and a repeated IV under
 * one key is catastrophic for GCM, whereas the birthday bound on random 96-bit IVs (NIST SP 800-38D, 2^32 invocations
 * per key) is not remotely approached when one invocation is one record write. `pt.fill(0)` afterwards is hygiene, not
 * a guarantee.
 *
 * @param aad - The record's own primary key: `${userId}|${eventId}` for events, {@link checkpointAad} for checkpoints.
 *     Authenticated but not encrypted, and {@link decryptJson} must be given the identical string. This is what stops
 *     an attacker with write access from re-filing a record under another user or event id.
 */
export async function encryptJson(dek: CryptoKey, value: unknown, aad: string): Promise<EncryptedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(JSON.stringify(value));
    const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
        dek,
        pt,
    );
    pt.fill(0);
    return { iv: encodeBase64(iv), ct: encodeBase64(new Uint8Array(ct)) };
}

/**
 * Open a blob written by {@link encryptJson} and parse it back. Nothing is zeroed here, deliberately: the plaintext
 * becomes an object graph this index keeps in memory on purpose. `aad` must be the identical string the record was
 * written with -- a mismatch is indistinguishable from corruption or tampering, and callers treat that as "this index
 * cannot be read".
 *
 * @knipignore - exported for tests
 */
export async function decryptJson<T>(dek: CryptoKey, blob: EncryptedBlob, aad: string): Promise<T> {
    const iv = decodeBase64(blob.iv);
    const ct = decodeBase64(blob.ct);
    const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
        dek,
        ct,
    );
    const text = new TextDecoder().decode(pt);
    return JSON.parse(text) as T;
}

/**
 * The tuple identifying a checkpoint, canonically and injectively encoded. Never reaches disk: it is the in-memory
 * identity used to de-duplicate and to find the entry to drop, and the message {@link checkpointKey} authenticates.
 * JSON rather than `|`-joining, which is not injective. `fullCrawl` is excluded, matching the v1 key, because the
 * crawler flips that flag on a checkpoint it means to replace in place.
 */
function checkpointIdentity(userId: string, cp: ICrawlerCheckpoint): string {
    return JSON.stringify([userId, cp.roomId, cp.token, cp.direction]);
}

/**
 * The primary key of a checkpoint record: base64 of HMAC-SHA256 over {@link checkpointIdentity}, under the sign-only
 * subkey from {@link deriveCheckpointMacKey} -- never the DEK. Keyed rather than a plain digest because room ids are
 * guessable, so `SHA-256("!room:example.org")` would be as good as cleartext. Deterministic, so a checkpoint handed to
 * {@link BrowserEventIndexManager.removeCrawlerCheckpoint} addresses exactly the record that was written.
 */
async function checkpointKey(macKey: CryptoKey, identity: string): Promise<string> {
    const mac = await crypto.subtle.sign("HMAC", macKey, new TextEncoder().encode(identity));
    return encodeBase64(new Uint8Array(mac));
}

/**
 * The AAD for a checkpoint record, binding its ciphertext to the user and to its own primary key. The `|cp|` keeps this
 * namespace disjoint from the `${userId}|${eventId}` form used for events, and binding the *hashed* key rather than the
 * cleartext tuple is what let the binding survive the v1 to v2 re-keying.
 */
function checkpointAad(userId: string, id: string): string {
    return `${userId}|cp|${id}`;
}

/**
 * The one and only upgrade path, v1 to v2, closing three leaks in one bump because v1 has never existed anywhere but
 * the branch introducing this file: the unread cleartext `roomId`/`ts`/`hasFile` columns and `byUserRoom` index on
 * `events`, the unread `deviceId` column on `meta`, and the `checkpoints` primary key, which was
 * `${userId}|${roomId}|${token}|${direction}` and so disclosed every room the crawler had a position for. Those keys
 * cannot be *converted* here: `onupgradeneeded` runs inside the `versionchange` transaction, long before any key
 * material exists, so the new HMAC cannot be computed yet. The `events` store is cleared with them, and that is the
 * point rather than collateral damage: `EventIndex` seeds fresh checkpoints **only** when {@link
 * BrowserEventIndexManager.isEventIndexEmpty} says the index is empty, so dropping checkpoints while keeping events
 * would leave an index that is not empty and has nowhere to resume from -- back-fill would stop for good, silently,
 * while the crawl-progress UI showed nothing outstanding. `meta` is kept, minus `deviceId`, because the salt is what
 * lets the next DEK match anything written after the upgrade. The accepted cost is one full re-crawl.
 */
function migrateV1ToV2(tx: IDBTransaction): void {
    const events = tx.objectStore("events");
    if (events.indexNames.contains("byUserRoom")) events.deleteIndex("byUserRoom");
    events.clear();
    tx.objectStore("checkpoints").clear();
    stripMetaDeviceId(tx.objectStore("meta"));
}

/**
 * Rewrite every `meta` record without v1's unread `deviceId` column. Cursor-driven rather than getAll/put so it stays
 * inside the `versionchange` transaction, which lives only as long as requests keep being issued against it.
 */
function stripMetaDeviceId(meta: IDBObjectStore): void {
    const cursorReq = meta.openCursor();
    cursorReq.onsuccess = (): void => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const rec = cursor.value as MetaRecord;
        cursor.update({ userId: rec.userId, salt: rec.salt, userVersion: rec.userVersion });
        cursor.continue();
    };
}

/**
 * Open the index database, creating or upgrading its schema as needed. Three stores: `meta`, keyed by `userId`, holding
 * the one cleartext row per user (the salt, readable *before* any key exists); `events`, keyed by the compound
 * `[userId, eventId]` so a single record is addressable for update and delete; and `checkpoints`, keyed by the opaque
 * {@link checkpointKey}. Both record stores carry a `byUser` index, the only way one user's rows can be enumerated
 * without scanning everything.
 *
 * @returns The open connection, with an `onversionchange` handler installed. Rejects when there is no `indexedDB`, when
 *     the open fails, and when the upgrade is *blocked* by an older connection in another tab -- which must reject
 *     rather than wait, since `EventIndexPeg.init()` is awaited on the path that starts the Matrix client and a pending
 *     promise there is an application that never finishes loading.
 */
function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const factory = globalThis.indexedDB;
        if (!factory) {
            reject(new Error("IndexedDB not available"));
            return;
        }
        const req = factory.open(EVENTINDEX_DB_NAME, EVENTINDEX_DB_VERSION);
        // An older connection holds the previous version open and blocks this upgrade for as long as its tab lives.
        // Reject instead of waiting: an unsettled promise here hangs the whole application.
        let abandoned = false;
        req.onblocked = (): void => {
            abandoned = true;
            reject(new Error("idb open blocked by an older connection"));
        };
        req.onerror = (): void => reject(req.error ?? new Error("idb open failed"));
        req.onsuccess = (): void => {
            const db = req.result;
            // Release the database when something else wants to delete or upgrade it, rather than blocking that
            // forever; without this a stale handle can survive a logout.
            db.onversionchange = (): void => db.close();
            // The blocking connection closed after all and the open went through, but nobody is waiting for this one
            // any more. Close it rather than leaking a handle that would block deleting the database.
            if (abandoned) {
                db.close();
                return;
            }
            resolve(db);
        };
        req.onupgradeneeded = (event: IDBVersionChangeEvent): void => {
            const db = req.result;
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "userId" });
            }
            if (!db.objectStoreNames.contains("events")) {
                const events = db.createObjectStore("events", { keyPath: ["userId", "eventId"] });
                events.createIndex("byUser", "userId", { unique: false });
            }
            if (!db.objectStoreNames.contains("checkpoints")) {
                const cps = db.createObjectStore("checkpoints", { keyPath: "id" });
                cps.createIndex("byUser", "userId", { unique: false });
            }
            if (event.oldVersion > 0 && event.oldVersion < 2 && req.transaction) {
                migrateV1ToV2(req.transaction);
            }
        };
    });
}

/**
 * Promisify a single IndexedDB request. It settles when the *request* succeeds, not when its transaction commits, which
 * is why every write path awaits {@link txDone} instead, and why callers must not await anything but further IndexedDB
 * work between requests on one transaction.
 */
function idbReq<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = (): void => resolve(req.result);
        req.onerror = (): void => reject(req.error ?? new Error("idb request failed"));
    });
}

/**
 * The bytes a base64 ciphertext stands for on disk. One function produces every number feeding {@link
 * BrowserEventIndexManager.ciphertextBytes}, so the total and its parts cannot disagree about how a record is measured.
 */
function ciphertextByteLength(ct: string): number {
    return Math.ceil((ct.length * 3) / 4);
}

/**
 * Drop the entire index database, for every user of this origin. Used only where per-user deletion cannot work or has
 * already failed; callers must close their own connection first, since an open handle blocks the delete. Rejects on
 * failure and -- importantly -- when the delete is merely *blocked*: resolving would tell the caller the ciphertext was
 * wiped while it is still on disk.
 */
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
        // A blocked delete has *not* happened: report it rather than claiming success, so callers can close their own
        // handle and retry.
        req.onblocked = (): void => reject(new Error("idb deleteDatabase blocked by an open connection"));
    });
}

/**
 * Best-effort removal of an index database left behind by a user who turned the labs flag off: nothing else would ever
 * delete it. Does nothing when the setting cannot be read, when the feature is on, or when there is no IndexedDB, and
 * never throws. Called from `WebPlatform` on the path where the gate is off, the only path where no manager exists and
 * so nothing can race the delete.
 */
export async function deleteDisabledEventIndexDb(): Promise<void> {
    if (typeof globalThis.indexedDB === "undefined") return;
    let enabled: boolean;
    try {
        enabled = Boolean(SettingsStore.getValue("feature_web_event_index"));
    } catch {
        return;
    }
    if (enabled) return;
    try {
        await deleteDatabase();
    } catch (e) {
        log.debug("EventIndex: could not drop the database of the disabled index", e);
    }
}

/**
 * The browser implementation of {@link BaseEventIndexManager}, one instance per `WebPlatform`, created lazily and only
 * while the labs gate is on. The **in-memory** state is the index: every query and every mutation is answered from it,
 * synchronously. The **IndexedDB** records are a write-behind encrypted copy whose only job is to make the next session
 * start warm, so everything keeps working for this session when persistence is unavailable or fails.
 */
export class BrowserEventIndexManager extends BaseEventIndexManager {
    /** The user this index belongs to, or null before {@link initEventIndex} / after teardown. */
    private userId: string | null = null;
    /**
     * The AES-GCM key protecting every record, from {@link deriveDek}. Null when no index is open; its presence is also
     * the "we have key material" test the persistence paths guard on.
     */
    private dek: CryptoKey | null = null;
    /**
     * HMAC subkey naming checkpoint records, see {@link checkpointKey}. Held separately from {@link
     * BrowserEventIndexManager.dek} precisely so the naming key is never the encryption key; both die with {@link
     * dropKey}.
     */
    private cpMacKey: CryptoKey | null = null;
    /**
     * Whether records should be written to disk at all. False when there is no pickle key to derive a stable DEK from,
     * when IndexedDB could not be opened, and during teardown. The index is fully functional for the session either
     * way; only the warm start is lost.
     */
    private persistEnabled = false;
    /**
     * True before the first {@link initEventIndex} and after teardown. The mutating entry points return early while it
     * is set, so a late callback from the crawler cannot repopulate an index that has just been torn down.
     */
    private closed = true;

    /** The index proper: record id (always an original event's id) -> the stored event. */
    private readonly events = new Map<string, StoredEvent>();
    /** m.replace event id -> id of the record its content was folded into. */
    private readonly editTargets = new Map<string, string>();
    /**
     * The inverted index: term -> ids of the records whose {@link StoredEvent.searchText} contains it. Maintained only
     * by {@link indexTokens} / {@link unindexTokens}, and pruned when a term's set empties.
     */
    private readonly inverted = new Map<string, Set<string>>();
    /**
     * Room id -> that room's record ids, ordered by `origin_server_ts` ascending. The ordering is an invariant,
     * maintained by {@link insertRoomOrder} and repaired by {@link reindexRoomOrder}; {@link contextFor} and {@link
     * loadFileEvents} depend on it.
     */
    private readonly roomOrder = new Map<string, string[]>();
    /** Outstanding crawler positions, cleartext in memory and mirrored encrypted to disk. */
    private checkpoints: ICrawlerCheckpoint[] = [];
    /** Schema version owned by `EventIndex`, round-tripped through the `meta` record. */
    private userVersion = 0;
    /**
     * Running total of ciphertext bytes, reported as {@link getStats} `size`. Kept equal to the sum of {@link
     * recordBytes} rather than accumulated: a rewrite replaces a record's contribution instead of adding a second one.
     */
    private ciphertextBytes = 0;
    /**
     * Memo of {@link foldText} over each record's {@link StoredEvent.searchText}, for the substring fallback; see
     * {@link foldedFor}. Purely derived, never persisted, and validated against the text it was computed from rather
     * than invalidated by hand.
     */
    private readonly foldedSearchText = new Map<string, { src: string; folded: string }>();
    /**
     * Ciphertext size of each event record *as it currently sits on disk*, which is what makes {@link ciphertextBytes}
     * a sum rather than a tally of everything ever written. Maintained only from inside the persistence chain, since a
     * record's size is not known until it has been encrypted, so it is empty in a memory-only session where {@link
     * getStats} falls back to {@link estimatePlainSize}.
     */
    private readonly recordBytes = new Map<string, number>();

    /**
     * The tail of the serialised persistence chain; see {@link enqueuePersist}. Awaiting it means "every write
     * scheduled so far has been attempted", which is what {@link commitLiveEvents} and the teardown paths do.
     */
    private persistChain: Promise<void> = Promise.resolve();
    /** The open IndexedDB connection, or null when memory-only or closed. */
    private db: IDBDatabase | null = null;

    /**
     * Whether this session may use the index; see {@link BaseEventIndexManager.supportsEventIndexing}. Re-reads the
     * live gate on every call, but do not mistake that for the feature being re-checked: `EventIndexPeg.init()` asks
     * once and caches the answer. Enforcing the gate is {@link featureEnabled}'s job; this is the honest report, not
     * the mechanism.
     */
    public async supportsEventIndexing(): Promise<boolean> {
        return isBrowserEventIndexEnabled();
    }

    /**
     * Open the index for a user and restore whatever was persisted for them; see {@link
     * BaseEventIndexManager.initEventIndex}. The order is load-bearing: discard any previous state, connection and key
     * material (the settings panel can re-initialise without closing first, and a leaked handle would later block
     * deleting the database); read this user's `meta` row, whose salt yields the same DEK as last time; derive the DEK
     * and checkpoint MAC subkey from the pickle key; then write `meta` if this is a first run and decrypt everything
     * stored for the user back into memory. Three fallbacks, all deliberate. Unavailable IndexedDB means carrying on
     * memory-only. No pickle key means deriving both keys from fresh random material and disabling persistence, so
     * leftover ciphertext stays unopenable -- the safe failure rather than the convenient one. And a record that fails
     * to decrypt means deleting every record for this user and resetting `userVersion` to 0, the expected response to a
     * rotated pickle key or a new device id rather than an error path. Does nothing at all while the labs gate is off
     * ({@link featureEnabled}): this is the path that would otherwise *create* the database, so a session that has
     * turned the feature off must not be able to put a fresh encrypted index on disk from the settings panel's Enable
     * button.
     */
    public async initEventIndex(userId: string, deviceId: string): Promise<void> {
        if (!this.featureEnabled("initEventIndex")) return;
        await this.resetMemory();
        // Re-initialising must not leak the previous connection, and the key material goes with it: the window between
        // opening the new database and deriving the new key would otherwise hold this user's id, the new connection and
        // the *previous* user's DEK, so a write landing there would be filed under one user and encrypted for another.
        this.closeDb();
        this.dropKey();
        this.persistEnabled = false;
        this.userId = userId;
        this.closed = false;

        const pickleKey = await PlatformPeg.get()?.getPickleKey(userId, deviceId);
        let salt = crypto.getRandomValues(new Uint8Array(32));
        let existingMeta: MetaRecord | undefined;

        try {
            this.db = await openDb();
            existingMeta = await this.loadMeta(userId);
            if (existingMeta?.salt) {
                salt = decodeBase64(existingMeta.salt);
                this.userVersion = existingMeta.userVersion ?? 0;
            }
        } catch (e) {
            log.warn("IndexedDB unavailable; index will be memory-only this session", e);
            this.db = null;
        }

        if (pickleKey) {
            this.dek = await deriveDek(pickleKey, salt, userId, deviceId);
            this.cpMacKey = await deriveCheckpointMacKey(pickleKey, salt, userId, deviceId);
            this.persistEnabled = this.db !== null;
        } else {
            // No pickle key: session-only DEK, so leftover ciphertext from a previous session cannot be opened.
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
            // Nothing persists on this path, but deriving the MAC subkey anyway keeps the
            // invariant "a DEK implies a checkpoint key" true everywhere else in the class.
            this.cpMacKey = await crypto.subtle.deriveKey(
                {
                    name: "HKDF",
                    hash: "SHA-256",
                    salt,
                    info: new TextEncoder().encode(`${EVENTINDEX_CPMAC_HKDF_INFO}|session`),
                },
                baseKey,
                { name: "HMAC", hash: "SHA-256", length: 256 },
                false,
                ["sign"],
            );
            this.persistEnabled = false;
            log.info("EventIndex: no pickle key; index will not persist across reload");
        }

        if (this.persistEnabled && this.db && this.dek) {
            if (!existingMeta) {
                await this.saveMeta({
                    userId,
                    salt: encodeBase64(salt),
                    userVersion: this.userVersion,
                });
            }
            const loaded = await this.loadAllForUser(userId);
            if (!loaded) {
                log.warn("EventIndex: stored ciphertext could not be decrypted; wiping leftover for this user");
                // Rows before the undecryptable one are already in memory. Drop them too, or isEventIndexEmpty() would
                // lie to the crawler about what is indexed.
                await this.resetMemory();
                await this.deleteUserRecords(userId);
                await this.saveMeta({
                    userId,
                    salt: encodeBase64(salt),
                    userVersion: 0,
                });
                this.userVersion = 0;
            }
        }
    }

    /**
     * Index one live event; see {@link BaseEventIndexManager.addEventToIndex}. Does nothing while the labs gate is off,
     * in memory as well as on disk ({@link featureEnabled}). The in-memory update is synchronous, so the event is
     * searchable immediately; only the encrypted write is deferred. Note that the record written is the one for {@link
     * targetId}: when `ev` is an edit it is the *original* message's record that changed.
     *
     * @param profile - The sender's display name and avatar *at the time of this event*, so a result can be rendered
     *     without the room being loaded.
     */
    public async addEventToIndex(ev: IMatrixEvent, profile: IMatrixProfile): Promise<void> {
        if (this.closed || !this.userId || !this.featureEnabled()) return;
        this.upsertEvent(ev, profile);
        this.schedulePersistEvent(this.targetId(ev));
    }

    /**
     * Remove an event from the index, in response to a redaction; see {@link BaseEventIndexManager.deleteEvent}. A
     * redaction may name an *edit*, whose content was folded into the original message's record, so the id is resolved
     * through {@link editTargets} first or the redacted text stays searchable under the original's id. The whole record
     * is then dropped rather than reverted, the pre-edit body having been overwritten in place.
     *
     * @returns True if a record was removed; false when nothing matched and also when the index is closed, which
     *     callers do not need to distinguish.
     */
    public async deleteEvent(eventId: string): Promise<boolean> {
        if (this.closed) return false;
        // Resolve an edit's id to the record its content was folded into; see the doc above.
        const targetId = this.events.has(eventId) ? eventId : (this.editTargets.get(eventId) ?? eventId);
        const existed = this.events.has(targetId);
        this.removeFromIndex(targetId);
        if (existed && this.persistEnabled && this.db && this.userId) {
            const userId = this.userId;
            this.enqueuePersist(async () => {
                const tx = this.db!.transaction("events", "readwrite");
                tx.objectStore("events").delete([userId, targetId]);
                await txDone(tx);
                this.ciphertextBytes -= this.recordBytes.get(targetId) ?? 0;
                this.recordBytes.delete(targetId);
            });
        }
        return existed;
    }

    /**
     * Whether the index holds no events at all; see {@link BaseEventIndexManager.isEventIndexEmpty}. It carries more
     * weight than its size suggests: `EventIndex.init` asks exactly once at start-up, and an empty answer is what makes
     * it seed a backward and a forward crawler checkpoint for every encrypted room on the next sync -- see {@link
     * migrateV1ToV2}.
     */
    public async isEventIndexEmpty(): Promise<boolean> {
        return this.events.size === 0;
    }

    /**
     * Whether any event from a room is indexed; see {@link BaseEventIndexManager.isRoomIndexed}. Answered from {@link
     * roomOrder}, whose entry is deleted outright when a room's last event goes. It says nothing about *how much* is
     * indexed.
     */
    public async isRoomIndexed(roomId: string): Promise<boolean> {
        const ids = this.roomOrder.get(roomId);
        return Boolean(ids && ids.length > 0);
    }

    /**
     * Index statistics for the settings UI; see {@link BaseEventIndexManager.getStats}. `size` is best-effort,
     * IndexedDB offering no per-database measurement: it reports {@link ciphertextBytes}, excluding store overhead,
     * keys and checkpoints, and falls back to {@link estimatePlainSize} where nothing has been persisted, since 0 bytes
     * for a populated index would read as a bug. `eventCount` and `roomCount` are exact.
     */
    public async getStats(): Promise<IIndexStats> {
        const rooms = new Set<string>();
        for (const ev of this.events.values()) rooms.add(ev.roomId);
        return {
            size: this.ciphertextBytes || this.estimatePlainSize(),
            eventCount: this.events.size,
            roomCount: rooms.size,
        };
    }

    /**
     * The caller's schema version; see {@link BaseEventIndexManager.getUserVersion}. Opaque here: `EventIndex` owns its
     * meaning. Reset to 0 whenever the index is wiped, so a rebuilt index is treated as new rather than as already
     * migrated.
     */
    public async getUserVersion(): Promise<number> {
        return this.userVersion;
    }

    /**
     * Record the caller's schema version; see {@link BaseEventIndexManager.setUserVersion}. Written straight through to
     * the `meta` row rather than onto the persistence chain, because the caller expects it to have taken effect when
     * the promise resolves. Skipped when there is no existing row to update.
     */
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

    /**
     * Flush queued writes; see {@link BaseEventIndexManager.commitLiveEvents}. On Desktop this commits a Seshat write
     * transaction and events are not searchable until it runs; here they are searchable the moment {@link
     * addEventToIndex} returns, so this only waits for the encrypted writes scheduled so far to have been attempted.
     * Never rejects, so awaiting the chain reports completion, not success.
     */
    public async commitLiveEvents(): Promise<void> {
        await this.persistChain;
    }

    /**
     * Run a query against the in-memory index; see {@link BaseEventIndexManager.searchEventIndex}. The pipeline:
     * tokenise the query exactly as indexed text was and intersect the per-term match sets, so a result must contain
     * *every* term (terms of two characters or more also match by prefix, so results narrow while the user is still
     * typing); fall back to a substring scan ({@link substringHits}) if that found nothing; filter by room; sort by
     * recency if asked; paginate by offset; then decorate each hit with its surrounding events ({@link contextFor}) and
     * a positional `rank`. Unlike Seshat there is no relevance scoring, phrase or field syntax, boolean operators or
     * stemming, and query cost is bounded by the number of *terms* in the index rather than by the number of events --
     * except on the substring fallback, which is linear in total indexed text.
     *
     * @param searchArgs - `search_term` is the raw user input; `room_id` scopes the search; `order_by_recency` sorts
     *     newest first rather than leaving the index's own iteration order; `limit` is the page size, where a missing
     *     or zero value means 10 and a negative one clamps to 1; `before_limit`/`after_limit` ask for context events
     *     either side of each hit; `next_batch` is an opaque token from a previous call.
     * @returns The page. `count` is the total number of matches rather than the page size, `highlights` the query's
     *     terms (returned even for an empty result, so the UI can mark them), and `next_batch` the token for the
     *     following page.
     */
    public async searchEventIndex(searchArgs: ISearchArgs): Promise<IResultRoomEvents> {
        const tokens = tokenize(searchArgs.search_term);
        const empty: IResultRoomEvents = { count: 0, results: [], highlights: tokens, next_batch: undefined };
        if (this.closed) return empty;

        // Intersect the per-term match sets, so a result must contain every term (AND, not OR). `ids === null` is the
        // sentinel for "no term processed yet", which is what lets the first term *seed* the set instead of being
        // intersected against it. An empty Set cannot play that role, and that distinction is the whole reason the
        // sentinel exists: empty already means "some term matched nothing", so starting from one would intersect the
        // first term's matches down to nothing and every query would return no results. A query with no terms therefore
        // starts at an empty Set deliberately -- the loop does not run and the decision passes to the substring
        // fallback below. The early break is not just an optimisation: once the intersection is empty no later term can
        // put anything back, so the remaining prefix scans over the whole vocabulary would be pure waste.
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

        // The term path found nothing: retry the raw query as a literal substring. See substringHits for what this
        // reaches that whole-word terms cannot.
        if (!ids || ids.size === 0) {
            ids = this.substringHits(searchArgs.search_term, searchArgs.room_id);
        }
        if (ids.size === 0) return empty;

        // Resolve ids to records, dropping any that have gone: a redaction between matching and reading must not become
        // an undefined result. Room scoping is applied here rather than inside the index, there being no per-room
        // posting lists.
        let hits = Array.from(ids, (eventId) => this.events.get(eventId)).filter((e): e is StoredEvent => Boolean(e));
        if (searchArgs.room_id) {
            hits = hits.filter((e) => e.roomId === searchArgs.room_id);
        }

        // Newest first when the caller asks. Otherwise the order is whatever fell out of the Set iteration above:
        // deterministic for a given index state, but derived from insertion order rather than from any notion of
        // relevance, which nothing here computes.
        if (searchArgs.order_by_recency) {
            hits.sort((a, b) => b.originServerTs - a.originServerTs);
        }

        // Pagination is a plain offset, and `next_batch` that offset back as a decimal string. An offset rather than a
        // cursor because the whole result set is recomputed from memory on every call, so events indexed between two
        // pages can shift rows across the boundary. A malformed token resolves to offset 0 rather than throwing at the
        // user.
        const offset = searchArgs.next_batch ? Number.parseInt(searchArgs.next_batch, 10) || 0 : 0;
        const limit = Math.max(1, searchArgs.limit || 10);
        const page = hits.slice(offset, offset + limit);
        const next_batch = offset + page.length < hits.length ? String(offset + page.length) : undefined;

        const beforeLimit = Math.max(0, searchArgs.before_limit || 0);
        const afterLimit = Math.max(0, searchArgs.after_limit || 0);

        const results = page.map((hit, i) => {
            const context = this.contextFor(hit, beforeLimit, afterLimit);
            return {
                // `rank` is positional, not a relevance score, and nothing should read a meaning into its magnitude. It
                // is 1/n over the hit's position in the *whole* result set rather than in the page, so any consumer
                // that sorts by rank reproduces the order chosen above. Seshat puts a real BM25 score here; the
                // substitution is safe only because nothing in Element reads it.
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

    /**
     * Index a batch of back-filled history and advance the crawler's position; see {@link
     * BaseEventIndexManager.addHistoricEvents}. The checkpoint swap happens after the events, so a crash between the
     * two re-fetches a batch rather than skipping it. Either checkpoint may be null; no new one means the crawl has
     * reached the end of that room's history.
     *
     * @returns True only if every event in the batch was already indexed *and* nothing about it changed. The crawler
     *     uses this to stop crawling backwards through a room it has covered, so a false negative costs a redundant
     *     page while a false positive would silently truncate history. An empty batch returns false, as does one
     *     dropped because the labs gate is shut: unlike true, false leaves the persisted crawl positions untouched.
     */
    public async addHistoricEvents(
        events: IEventAndProfile[],
        checkpoint: ICrawlerCheckpoint | null,
        oldCheckpoint: ICrawlerCheckpoint | null,
    ): Promise<boolean> {
        if (this.closed || !this.featureEnabled()) return false;
        let allAlready = events.length > 0;
        // Three cases per event, which is why this is not just a call to upsertEvent:
        //
        // 1. An unedited record for this id and a non-edit incoming event: the ordinary "seen it already" case. Text
        //    and file flag are recomputed rather than trusted, because the crawler can hand back a better copy than the
        //    live timeline gave us. Only a real difference re-indexes or clears the "nothing new here" flag.
        // 2. A record already edited, and this is the original arriving late: the edit's content must survive, only the
        //    envelope is taken.
        // 3. Anything else -- a new event, or an edit for a record we hold -- is a plain upsert.
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
                // Original arriving after an edit: keep the new body, take the envelope. That rewrites the record and
                // schedules a persist, so it must clear the flag -- a batch made only of these would otherwise report
                // "all already added" and end the back-fill.
                this.upsertEvent(event, profile);
                this.schedulePersistEvent(id);
                allAlready = false;
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

    /**
     * Record a crawler position; see {@link BaseEventIndexManager.addCrawlerCheckpoint}. Idempotent by tuple: the
     * encrypted record hashes to the same key, so it overwrites itself rather than accumulating. `fullCrawl` is not
     * part of the identity ({@link checkpointIdentity}), so re-adding a checkpoint that differs only in that flag keeps
     * the *first* one's value. Gated on the labs flag, a checkpoint being a record in the same encrypted store.
     */
    public async addCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        if (this.closed || !this.userId || !this.featureEnabled()) return;
        const userId = this.userId;
        // De-duplication compares the cleartext tuple, not the record key: the in-memory list is
        // cleartext anyway, and this keeps the hot path off an async MAC.
        const identity = checkpointIdentity(userId, checkpoint);
        if (!this.checkpoints.some((c) => checkpointIdentity(userId, c) === identity)) {
            this.checkpoints.push(checkpoint);
        }
        await this.persistCheckpoint(checkpoint);
    }

    /**
     * Retire a crawler position; see {@link BaseEventIndexManager.removeCrawlerCheckpoint}. Matched by room, token and
     * direction, ignoring `fullCrawl`; one that is not held is silently ignored. Addressing the right record is only
     * possible because {@link checkpointKey} is deterministic -- which is also the residual equality leak in the threat
     * model above.
     */
    public async removeCrawlerCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        if (!this.userId) return;
        const userId = this.userId;
        const identity = checkpointIdentity(userId, checkpoint);
        this.checkpoints = this.checkpoints.filter((c) => checkpointIdentity(userId, c) !== identity);
        if (this.persistEnabled && this.db && this.cpMacKey) {
            const macKey = this.cpMacKey;
            this.enqueuePersist(async () => {
                // The MAC is computed before the transaction is opened: awaiting anything that
                // is not an IndexedDB request inside a live transaction lets it auto-close.
                const id = await checkpointKey(macKey, identity);
                const tx = this.db!.transaction("checkpoints", "readwrite");
                tx.objectStore("checkpoints").delete(id);
                await txDone(tx);
            });
        }
    }

    /**
     * Every outstanding crawler position; see {@link BaseEventIndexManager.loadCheckpoints}. Served from memory, the
     * records having been decrypted once during {@link initEventIndex}. The array is copied because the caller keeps it
     * as its own work queue and shifts entries off it.
     */
    public async loadCheckpoints(): Promise<ICrawlerCheckpoint[]> {
        return this.checkpoints.slice();
    }

    /**
     * Page through a room's attachments, for the room file panel; see {@link BaseEventIndexManager.loadFileEvents}.
     * Keeps the records whose {@link StoredEvent.hasFile} was set when indexed, and sorts ascending then reverses for a
     * backward read rather than sorting by direction, so both directions derive from the same total order.
     *
     * @param args - `roomId` selects the room; `limit` is the page size, where a missing or zero value means 10 and a
     *     negative one clamps to 1; `direction` is "b" for newest-first and anything else for oldest-first, defaulting
     *     to backwards; `fromEvent` is an event id from a previous page, and results start immediately after it. One
     *     that is no longer indexed ends the listing rather than erroring, since restarting from the first page would
     *     turn a panel that pages until it gets an empty answer into an endless loop.
     */
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
            // An unknown cursor is the end of the listing, not the start of it: see above.
            if (idx < 0) return [];
            start = idx + 1;
        }
        return files.slice(start, start + Math.max(1, args.limit || 10)).map((e) => ({
            event: this.resultEvent(e.event),
            profile: e.profile,
        }));
    }

    /**
     * Shut the index down without destroying it; see {@link BaseEventIndexManager.closeEventIndex}. Queued writes are
     * flushed first, then the keys are dropped, memory cleared and the connection closed; a failed flush is logged and
     * teardown continues, since refusing to close would leave the keys in memory. The records stay on disk -- the point
     * of the distinction from {@link deleteEventIndex} -- inert without the pickle key.
     */
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
    }

    /**
     * Destroy the index and everything it has written; see {@link BaseEventIndexManager.deleteEventIndex}. Reached from
     * the settings panel and from `Lifecycle.clearStorage()`, so it must work on a half-dismantled session -- which is
     * why `WebPlatform` keeps returning an existing manager even after the labs flag goes off. Per-user deletion is
     * preferred, the database being shared by every account that has used this origin, and dropping the whole thing is
     * the fallback. Failure is survivable: leftover ciphertext is unreadable without the pickle key, which `Lifecycle`
     * destroys on the same path.
     */
    public async deleteEventIndex(): Promise<void> {
        const userId = this.userId;
        // Stop accepting work, then let what is already in flight finish: resetMemory() replaces the chain, so an
        // operation that captured `this.db` could otherwise open its transaction after the wipe and write a ciphertext
        // row back in.
        this.closed = true;
        this.persistEnabled = false;
        try {
            await this.persistChain;
        } catch (e) {
            log.warn("EventIndex: flush before wipe failed", e);
        }
        this.dropKey();
        await this.resetMemory();
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
    }

    /**
     * The live labs gate, re-read on every path that can add to the index. `WebPlatform.getEventIndexingManager()`
     * hands out an already-constructed manager whatever the setting now says, because `Lifecycle.clearStorage()` wipes
     * the setting's storage *before* it asks for the manager to delete the index -- teardown has to stay reachable.
     * That makes this object, not the platform, the only place left that can enforce the gate, since `EventIndex` asks
     * {@link supportsEventIndexing} exactly once and caches the answer. Every method that can *create or grow* the
     * at-rest index consults this ({@link initEventIndex}, {@link addEventToIndex}, {@link addHistoricEvents}, {@link
     * addCrawlerCheckpoint}); every method that *removes* something deliberately does not ({@link deleteEvent}, {@link
     * removeCrawlerCheckpoint}, {@link closeEventIndex}, {@link deleteEventIndex}), because turning the feature off
     * must stop the writing without disarming the wiping. {@link setUserVersion} is not gated either, since it rewrites
     * one number in an existing `meta` row. Reads are left alone.
     */
    private featureEnabled(reason?: string): boolean {
        if (isBrowserEventIndexEnabled()) return true;
        if (reason) log.debug(`EventIndex: ${reason} ignored because the feature is turned off`);
        return false;
    }

    /**
     * The record id an event belongs under: the id of the message it edits, or its own. Anything that schedules a
     * persist must use it, because the record that changed when an edit arrives is the original's.
     */
    private targetId(ev: IMatrixEvent): string {
        return replacedEventId(ev) ?? ev.event_id;
    }

    /**
     * Insert or update the record for an event, maintaining every in-memory structure around it. This is where the edit
     * model lives. An edit never gets a record of its own: its content is folded into the record of the message it
     * replaces, and the edit's id is remembered in {@link editTargets} so a later redaction of the edit can find that
     * record. Events arrive from two directions at once -- the live timeline forwards, the crawler backwards -- so an
     * edit and its original can turn up in either order, hence four cases:
     *
     * 1. **Edit for a record we hold.** Re-index around the new content, splicing it onto the *existing* envelope so
     *    sender, timestamp and event id stay the original's.
     * 2. **Original arriving after its edit.** Take the original's envelope but keep the edited content, correcting the
     *    timestamp used for ordering.
     * 3. **Duplicate of an unedited record.** Nothing to do.
     * 4. **Anything new.** Build a fresh record, marked already edited if it is an edit whose original has not been
     *    seen, so case 2 can repair the envelope later without the original reverting the body.
     *
     * @param ev - As received, not the output of {@link effectiveEventForIndex}, which this calls itself. One with no
     *     `event_id`/`room_id` is dropped silently.
     */
    private upsertEvent(ev: IMatrixEvent, profile: IMatrixProfile): void {
        const origId = replacedEventId(ev);
        const targetId = origId ?? ev.event_id;
        if (!targetId || !ev.room_id) return;

        const existing = this.events.get(targetId);
        const incoming = effectiveEventForIndex(ev);

        // Case 1: an edit for a record we hold. Only `content` moves across; the envelope stays
        // the original's, which is what keeps results pointing at the visible message.
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
            this.rememberEdit(existing, ev.event_id);
            this.indexTokens(existing.eventId, existing.searchText);
            return;
        }

        if (existing && !origId && existing.edited) {
            // Case 2: historic original after an edit: keep the new body, take envelope.
            existing.event = {
                ...incoming,
                content: existing.event.content,
            };
            const previousTs = existing.originServerTs;
            existing.originServerTs = incoming.origin_server_ts ?? existing.originServerTs;
            existing.profile = profile ?? existing.profile;
            // The record has moved in time, so its place in the room's ordered list has to move with it.
            if (existing.originServerTs !== previousTs) this.reindexRoomOrder(existing);
            return;
        }

        // Case 3: a duplicate of an unedited record. It cannot be improved from here, and re-indexing would churn the
        // inverted index for nothing.
        if (existing && !origId) {
            return;
        }

        // Case 4: nothing held for this id. `edited` is seeded from whether this is an edit, so an
        // edit that arrives before its original is already protected against case 2 reverting it.
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
        if (origId) this.rememberEdit(stored, ev.event_id);
        this.indexTokens(targetId, stored.searchText);
        this.insertRoomOrder(stored);
    }

    /**
     * Note that `editId` (an m.replace event) was folded into `stored`, so a redaction naming the edit can find the
     * record to remove. Both directions are recorded: {@link StoredEvent.editIds} on the record, which survives to disk
     * inside the ciphertext, and the reverse lookup in {@link editTargets}, rebuilt from those ids on load. `editId` is
     * ignored when it equals the record's own id, or redacting the original would resolve back to the same record.
     */
    private rememberEdit(stored: StoredEvent, editId: string): void {
        if (!editId || editId === stored.eventId) return;
        const editIds = (stored.editIds ??= []);
        if (!editIds.includes(editId)) editIds.push(editId);
        this.editTargets.set(editId, stored.eventId);
    }

    /**
     * Add a record to its room's id list, keeping that list ordered by `origin_server_ts` ascending -- an invariant the
     * rest of the class reads without re-checking, since {@link contextFor} slices it for the events around a hit and
     * {@link loadFileEvents} walks it to page through attachments. Events genuinely do not arrive in timestamp order,
     * so the position is found by binary search and spliced in; appending and re-sorting instead costs a full sort per
     * indexed event, O(n^2 log n) comparisons to build one room's list, on the main thread inside the awaited login
     * path. The search is for the *upper* bound, so a tied timestamp lands where a stable "append, then sort" put it.
     * There is deliberately no "already present?" check: it would be a linear scan on the hot path, and it would be
     * dead code. {@link upsertEvent} only reaches here when {@link events} held nothing for the id, {@link
     * reindexRoomOrder} splices the id out immediately before re-inserting it, and a warm start does not come through
     * here at all -- {@link loadAllForUser} appends every row and sorts each room's list once.
     */
    private insertRoomOrder(stored: StoredEvent): void {
        let list = this.roomOrder.get(stored.roomId);
        if (!list) {
            list = [];
            this.roomOrder.set(stored.roomId, list);
        }
        let lo = 0;
        let hi = list.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if ((this.events.get(list[mid])?.originServerTs ?? 0) <= stored.originServerTs) lo = mid + 1;
            else hi = mid;
        }
        list.splice(lo, 0, stored.eventId);
    }

    /**
     * Move a record to its correct place in its room's ordered list after its timestamp changed. The one thing that
     * re-times a filed record is an original message arriving after the edit that replaced it, when {@link upsertEvent}
     * adopts the original's envelope. Repairing it here makes the ordering invariant hold at every point rather than
     * eventually.
     */
    private reindexRoomOrder(stored: StoredEvent): void {
        const list = this.roomOrder.get(stored.roomId);
        if (!list) return;
        const at = list.indexOf(stored.eventId);
        if (at >= 0) list.splice(at, 1);
        this.insertRoomOrder(stored);
    }

    /**
     * Remove a record from every in-memory structure at once, because they have to stay consistent or later reads break
     * in ways that are hard to trace: {@link inverted}, {@link events}, {@link foldedSearchText}, {@link editTargets}
     * and {@link roomOrder} (whose entry is deleted entirely when a room's last event goes, so {@link isRoomIndexed}
     * need not check for emptiness). {@link recordBytes} is the exception, describing what is on *disk*, where the row
     * survives until the delete this caller queues has committed.
     *
     * @param eventId - A record id, not an edit's id; resolve that through {@link editTargets} first. Unknown ids are a
     *     no-op, and nothing here touches the database.
     */
    private removeFromIndex(eventId: string): void {
        const existing = this.events.get(eventId);
        if (!existing) return;
        this.unindexTokens(eventId, existing.searchText);
        this.events.delete(eventId);
        this.foldedSearchText.delete(eventId);
        for (const editId of existing.editIds ?? []) this.editTargets.delete(editId);
        const list = this.roomOrder.get(existing.roomId);
        if (list) {
            const next = list.filter((id) => id !== eventId);
            if (next.length) this.roomOrder.set(existing.roomId, next);
            else this.roomOrder.delete(existing.roomId);
        }
    }

    /**
     * Add a record's terms to the inverted index. Paired with {@link unindexTokens}, and the pairing is a precondition
     * rather than a convention: both re-tokenise the text they are given, so removing a record's terms requires passing
     * the *same text it was indexed with* -- which is why {@link upsertEvent} unindexes before it overwrites
     * `searchText`, never after.
     */
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

    /**
     * Remove a record's terms from the inverted index, passing the exact text the record was indexed with; see {@link
     * indexTokens}. A term whose posting set empties is deleted rather than left behind: {@link lookupToken} walks the
     * entire vocabulary on every prefix query, so dead terms would make queries progressively slower for the life of
     * the session.
     */
    private unindexTokens(eventId: string, text: string): void {
        for (const token of tokenize(text)) {
            const set = this.inverted.get(token);
            if (!set) continue;
            set.delete(eventId);
            if (set.size === 0) this.inverted.delete(token);
        }
    }

    /**
     * The fallback matcher: a linear scan for the query as a literal substring of stored text. Reached only when the
     * term path in {@link searchEventIndex} produced nothing, it covers what whole-word terms plus prefix matching
     * cannot reach at all -- a fragment from the middle of a word, a query whose punctuation split it into terms that
     * never co-occur, and scripts written without word separators. The three-character floor keeps it affordable, and
     * {@link foldedFor} memoises each record's folded text so the folding is not repeated per query. Whitespace runs in
     * the query are collapsed to single spaces and the result trimmed. That normalises the *query* side only: stored
     * text is folded but never whitespace-normalised, so a multi-word query matches only where the stored text
     * separates those words by exactly single spaces -- a body holding a newline between `hello` and `world` is not
     * found by `hello world`. The words must appear adjacent and in order; this is a substring test, not a looser
     * second term search.
     */
    private substringHits(rawQuery: string, roomId?: string): Set<string> {
        const folded = foldText(rawQuery).replace(/\s+/g, " ").trim();
        const out = new Set<string>();
        if (folded.length < 3) return out;
        for (const ev of this.events.values()) {
            if (roomId && ev.roomId !== roomId) continue;
            if (this.foldedFor(ev).includes(folded)) out.add(ev.eventId);
        }
        return out;
    }

    /**
     * One record's search text, folded, from the memo. The memo stores the text it was folded from beside the result
     * and re-folds when the two no longer match, rather than being invalidated wherever {@link StoredEvent.searchText}
     * is written. That is why it is safe: a cache updated at each of those four assignments would be one forgotten line
     * away from serving a stale body to the substring fallback, which fails silently.
     */
    private foldedFor(ev: StoredEvent): string {
        const memo = this.foldedSearchText.get(ev.eventId);
        if (memo && memo.src === ev.searchText) return memo.folded;
        const folded = foldText(ev.searchText);
        this.foldedSearchText.set(ev.eventId, { src: ev.searchText, folded });
        return folded;
    }

    /**
     * Every record id matching one query term, as a fresh Set -- never one of the index's own posting sets, because
     * {@link searchEventIndex} adopts this object directly as the running intersection for the first term.
     *
     * @param prefix - When true, indexed terms that *start with* `token` match as well as the exact term, so typing
     *     "mess" already finds "message". It costs a walk over the whole vocabulary, which is why the caller passes
     *     false for single-character terms; the inner length check repeats that condition, so the prefix walk is
     *     unreachable for one-character terms.
     */
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

    /**
     * The events immediately around a hit, for the lines of context shown with a search result. Slices the room's
     * timestamp-ordered id list either side of the hit, so the context is the neighbourhood *in the index*, not in the
     * room: anything not indexed is simply absent, and a gap does not announce itself as one.
     *
     * @returns The two event lists in timeline order plus `profile_info`, mapping sender MXID to the profile recorded
     *     when that sender's event was indexed, so results render with the display name and avatar of the time. A hit
     *     absent from its own room list yields two empty lists rather than throwing.
     */
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
        const consider = [
            hit,
            ...beforeIds.map((id) => this.events.get(id)!),
            ...afterIds.map((id) => this.events.get(id)!),
        ];
        for (const ev of consider) {
            if (ev.event.sender) profile_info[ev.event.sender] = ev.profile;
        }
        return { events_before, events_after, profile_info };
    }

    /**
     * Prepare a stored event for handing out in a result. It returns a *shallow copy*, because js-sdk's search
     * processing decorates the events it is given and a consumer must not corrupt the index's own record. And it
     * removes `state_key` when it is explicitly `null`: js-sdk treats the presence of the key as "this is a state
     * event" regardless of its value, so a null one turns a message into a malformed state event downstream.
     */
    private resultEvent(ev: IMatrixEvent): IMatrixEvent {
        const copy = { ...ev } as IMatrixEvent & { state_key?: unknown };
        if (copy.state_key === null) delete copy.state_key;
        return copy;
    }

    /**
     * Queue an encrypted write of one record onto the persistence chain. The record is captured by reference and
     * serialised only when its turn comes, so a message edited twice in quick succession is written once, in its final
     * state; `userId` and the DEK are captured by value instead, so a write scheduled just before a logout cannot be
     * redirected at another user's rows.
     *
     * @param eventId - The *record* id, i.e. {@link targetId} of the event that arrived, never an edit's own id.
     */
    private schedulePersistEvent(eventId: string): void {
        if (!this.persistEnabled || !this.dek || !this.db || !this.userId) return;
        const stored = this.events.get(eventId);
        if (!stored) return;
        const userId = this.userId;
        const dek = this.dek;
        this.enqueuePersist(async () => {
            const blob = await encryptJson(dek, stored, `${userId}|${eventId}`);
            const rec: EventRecord = { userId, eventId, blob };
            const tx = this.db!.transaction("events", "readwrite");
            tx.objectStore("events").put(rec);
            await txDone(tx);
            // Only once it has committed, and replacing this record's previous contribution
            // rather than adding to it: this is a put, so a rewrite leaves one row, not two.
            const bytes = ciphertextByteLength(blob.ct);
            this.ciphertextBytes += bytes - (this.recordBytes.get(eventId) ?? 0);
            this.recordBytes.set(eventId, bytes);
        });
    }

    /**
     * Queue an encrypted write of one crawler checkpoint. The identity string is computed eagerly, pinning the
     * checkpoint's values at the moment it was added; the MAC over it is computed inside the queued operation but
     * before the transaction is opened, keeping a non-IndexedDB await out of a live transaction that would otherwise
     * auto-close mid-write.
     */
    private async persistCheckpoint(checkpoint: ICrawlerCheckpoint): Promise<void> {
        if (!this.persistEnabled || !this.dek || !this.cpMacKey || !this.db || !this.userId) return;
        const userId = this.userId;
        const dek = this.dek;
        const macKey = this.cpMacKey;
        const identity = checkpointIdentity(userId, checkpoint);
        this.enqueuePersist(async () => {
            const id = await checkpointKey(macKey, identity);
            const blob = await encryptJson(dek, checkpoint, checkpointAad(userId, id));
            const rec: CheckpointRecord = { id, userId, blob };
            const tx = this.db!.transaction("checkpoints", "readwrite");
            tx.objectStore("checkpoints").put(rec);
            await txDone(tx);
        });
    }

    /**
     * Append an operation to the single, serialised persistence chain. IndexedDB already serialises overlapping
     * readwrite transactions, so the point is not mutual exclusion but *ordering*: each operation does asynchronous
     * crypto before opening its transaction, so without the chain a record's write could commit after the delete meant
     * to follow it. Awaiting {@link persistChain} is therefore a meaningful barrier. Failures are logged and swallowed
     * rather than propagated, and that is a decision rather than an omission: a rejection left on the chain would fail
     * every write scheduled after it, and a failed write costs only durability. The cost is that a disk refusing writes
     * shows up only as an index that keeps starting cold.
     */
    private enqueuePersist(op: () => Promise<void>): void {
        this.persistChain = this.persistChain.then(op).catch((e) => {
            log.warn("EventIndex persist failed", e);
        });
    }

    /**
     * Read a user's `meta` row. This is the one read that has to work before any key exists, which is why the row is
     * cleartext: it carries the salt the DEK is derived from. Undefined covers both "no index yet" and "no database",
     * whose response is the same: generate a salt and start fresh.
     */
    private async loadMeta(userId: string): Promise<MetaRecord | undefined> {
        if (!this.db) return undefined;
        const tx = this.db.transaction("meta", "readonly");
        return idbReq(tx.objectStore("meta").get(userId));
    }

    /**
     * Write a user's `meta` row, replacing any existing one. Written directly rather than through {@link
     * enqueuePersist}, because the salt must be on disk before the records encrypted under the key derived from it, or
     * a crash in between would leave ciphertext nothing can derive a key for.
     */
    private async saveMeta(meta: MetaRecord): Promise<void> {
        if (!this.db) return;
        const tx = this.db.transaction("meta", "readwrite");
        tx.objectStore("meta").put(meta);
        await txDone(tx);
    }

    /**
     * Decrypt everything stored for a user and rebuild the in-memory index from it, once, from {@link initEventIndex}.
     * Events and checkpoints are read in two separate transactions, each closed before its records are decrypted:
     * decryption is asynchronous and not an IndexedDB operation, so doing it inside a live transaction would let the
     * transaction auto-close underneath the loop.
     *
     * @returns True when everything loaded, including the vacuous cases of no records, no database or no key. False on
     *     the *first* record that will not decrypt -- deliberately without cleaning up, because the caller's contract
     *     is to reset memory and delete every record for the user. Such a failure is expected rather than exceptional:
     *     it is what a rotated pickle key or a new device id looks like from the inside.
     */
    private async loadAllForUser(userId: string): Promise<boolean> {
        if (!this.db || !this.dek) return true;
        const dek = this.dek;
        const evTx = this.db.transaction("events", "readonly");
        const evIdx = evTx.objectStore("events").index("byUser");
        const evRows = (await idbReq(evIdx.getAll(userId))) as EventRecord[];
        await txDone(evTx);

        this.ciphertextBytes = 0;
        this.recordBytes.clear();
        for (const row of evRows) {
            try {
                const stored = await decryptJson<StoredEvent>(dek, row.blob, `${userId}|${row.eventId}`);
                this.events.set(stored.eventId, stored);
                for (const editId of stored.editIds ?? []) this.editTargets.set(editId, stored.eventId);
                this.indexTokens(stored.eventId, stored.searchText);
                // Appended now and ordered once below, rather than placed per row: paying an ordering step per record
                // is what made start-up quadratic in the size of a room. Rows arrive in key order, not timestamp order,
                // so the sort below is what makes these the ascending lists insertRoomOrder promises.
                const list = this.roomOrder.get(stored.roomId);
                if (list) list.push(stored.eventId);
                else this.roomOrder.set(stored.roomId, [stored.eventId]);
                const bytes = ciphertextByteLength(row.blob.ct);
                this.recordBytes.set(stored.eventId, bytes);
                this.ciphertextBytes += bytes;
            } catch {
                return false;
            }
        }
        // One sort per room. `sort` is stable and every id was pushed in row order, so this produces exactly the list
        // repeated stable insertion would have.
        for (const list of this.roomOrder.values()) {
            list.sort((a, b) => (this.events.get(a)?.originServerTs ?? 0) - (this.events.get(b)?.originServerTs ?? 0));
        }

        const cpTx = this.db.transaction("checkpoints", "readonly");
        const cpIdx = cpTx.objectStore("checkpoints").index("byUser");
        const cpRows = (await idbReq(cpIdx.getAll(userId))) as CheckpointRecord[];
        await txDone(cpTx);
        this.checkpoints = [];
        for (const row of cpRows) {
            try {
                const cp = await decryptJson<ICrawlerCheckpoint>(dek, row.blob, checkpointAad(userId, row.id));
                this.checkpoints.push(cp);
            } catch {
                return false;
            }
        }
        return true;
    }

    /**
     * Delete every row belonging to one user: events, checkpoints and the `meta` row. Per-user rather than per-database
     * because the database is shared by every account that has signed in to this origin. The `meta` row goes too, and
     * with it the salt, so the next {@link initEventIndex} derives a *different* DEK and any row that somehow survived
     * is unreadable afterwards.
     */
    private async deleteUserRecords(userId: string): Promise<void> {
        if (!this.db) return;
        const evTx = this.db.transaction("events", "readwrite");
        const evStore = evTx.objectStore("events");
        const evRows = await idbReq(evStore.index("byUser").getAllKeys(userId));
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

    /**
     * A rough in-memory size for {@link getStats}, used when nothing has been persisted: the searchable text plus a
     * flat 64 bytes per record. It exists so the settings panel shows a plausible figure rather than "0 bytes", and no
     * decision depends on the number.
     */
    private estimatePlainSize(): number {
        let n = 0;
        for (const ev of this.events.values()) n += ev.searchText.length + 64;
        return n;
    }

    /**
     * Release both key handles. Dropping the references is the whole of it and is enough: the keys are non-extractable,
     * so the key material never existed in JavaScript memory to be zeroed.
     */
    private dropKey(): void {
        this.dek = null;
        this.cpMacKey = null;
    }

    /**
     * Discard all in-memory state and start the persistence chain over. Resetting {@link persistChain} to a resolved
     * promise is the part with teeth: it detaches any operations still queued from anything that awaits the chain
     * afterwards. That is why both teardown paths await the *old* chain before calling this, and why {@link
     * deleteEventIndex} clears {@link persistEnabled} first.
     */
    private async resetMemory(): Promise<void> {
        this.events.clear();
        this.editTargets.clear();
        this.foldedSearchText.clear();
        this.inverted.clear();
        this.roomOrder.clear();
        this.checkpoints = [];
        this.userVersion = 0;
        this.ciphertextBytes = 0;
        this.recordBytes.clear();
        this.persistChain = Promise.resolve();
    }

    /**
     * Close the IndexedDB connection and forget it. Failures are swallowed because every caller is on a teardown path,
     * where an already-closed or broken handle is exactly the case that throws and also the case where it no longer
     * matters. What does matter is that {@link db} ends up null either way.
     */
    private closeDb(): void {
        try {
            this.db?.close();
        } catch {
            /* ignore */
        }
        this.db = null;
    }
}

/**
 * Await an IndexedDB transaction's outcome. `oncomplete` is the only signal that its writes are durable, which is why
 * every write path awaits this rather than the individual `put`/`delete` requests: those report success as soon as the
 * operation is queued, and a transaction can still abort afterwards -- quota exhaustion being the likeliest case here.
 */
function txDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = (): void => resolve();
        tx.onerror = (): void => reject(tx.error ?? new Error("idb tx failed"));
        tx.onabort = (): void => reject(tx.error ?? new Error("idb tx aborted"));
    });
}
