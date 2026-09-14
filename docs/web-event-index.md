# Encrypted message search in the browser

The browser `EventIndex` is the web implementation of `BaseEventIndexManager`, the interface Element
Desktop serves with [Seshat](https://github.com/matrix-org/seshat). It lets the stock Search UX work in
encrypted rooms in Element Web, where the homeserver cannot do the search for us. It ships behind the
labs flag `feature_web_event_index` (see [Labs](labs.md)) and lives in
[`apps/web/src/vector/platform/BrowserEventIndexManager.ts`](https://github.com/element-hq/element-web/blob/develop/apps/web/src/vector/platform/BrowserEventIndexManager.ts),
introduced in [element-web#34718](https://github.com/element-hq/element-web/pull/34718).

This document records the platform model, the prior art and the performance measurements behind the
design, so that the reasoning travels with the code. It states what is a hard platform limit, what was
measured and on what, and what is still an assumption with the experiment that would settle it.

## 1. Purpose and scope

The feature indexes the message text the client has already decrypted, keeps it encrypted at rest in a
dedicated IndexedDB database, and answers Search from it. The query engine is a plain inverted index over
whitespace-ish tokens with a substring fallback, not a search engine: there is no ranking, no stemming and
no phrase query. The index covers message bodies, filenames and caption text, not the contents of media or
other attachments. Population is the job of the existing shared crawler in `EventIndex.ts`, unchanged, so
results are incomplete until it has run.

It is explicitly **not a port of Seshat**. Seshat is Tantivy plus SQLCipher on a real filesystem with
threads; the browser has one main thread, a heap ceiling it cannot catch, and a storage layer that is a
key-value store. The shape that works here is therefore its own design, and section 6 is that design.

It is also **not an archive**. The index is a recency window over the most recent rooms, bounded by named
constants (section 9), and the honest description of what a user gets is "search covers messages newer
than {date}", not "search covers your history".

Sections 2 to 6 describe the platform, the prior art, the measurements and the design those produce.
**Section 7 records what of that design has actually been built and measured**, which is not the same thing
and is kept separate on purpose.

## 2. Threat model

The data encryption key is derived with HKDF-SHA256 from the session pickle key, whose own ciphertext and
wrapping key live in the same origin's IndexedDB, so an attacker who exfiltrates only the
`element-eventindex` database learns metadata rather than message content, while one who takes the whole
browser profile can re-derive the key and read everything, which is the assumption Element already makes
for access tokens. Against XSS in this origin it buys nothing, because script there can ask the platform
for the pickle key or read the already-decrypted in-memory index. The precise statement is maintained in
the `## Threat model` section of the file header in
[`BrowserEventIndexManager.ts`](https://github.com/element-hq/element-web/blob/develop/apps/web/src/vector/platform/BrowserEventIndexManager.ts);
that header is the normative version and is summarised, not duplicated, here.

**Under schema v3 the complete cleartext key set, across every store, is `userId`, `chunkId`, the manifest
page keys and the HKDF salt.** `eventId` has left it entirely. A `chunks` record is keyed `[userId,
chunkId]`, where `chunkId` is a per-user monotonic counter with no relationship to any room, event id or
timestamp, and every event the chunk holds, ids included, lives inside its ciphertext. Checkpoint records
are keyed by an HMAC of the checkpoint tuple, so no room id, token or direction is on disk in the clear,
though equality and count still are. The `meta` store carries `userId`, the salt, `userVersion` and small
scalar bookkeeping (chunk and page counts, the open chunk id); the manifest pages and the oldest-indexed
timestamp live there as their own encrypted rows. What remains is shape: the number of chunk records
approximates events divided by events per chunk, and each ciphertext length the size of the events it
packs, which is coarser than schema v2's one length per event. Every record is AAD-bound to its own key,
so a record cannot be re-filed under another user or chunk id and still decrypt, which is no defence
against deletion or rollback. Section 7 records that this closes the leak schema v2 had to admit, where a
cleartext `eventId` disclosed which rooms were indexed to anyone able to map event ids back to rooms.

**Migration is a reset, not a conversion.** A v1 or v2 database is dropped in `onupgradeneeded`, inside
the same `versionchange` transaction that bumps the schema version, before any application code including
this class ever reads from it, so there is no window of any length in which a live `events` store with
cleartext `eventId` keys is open under v3. The cost is a re-crawl, which the crawl window and room cap of
section 7 bound. The alternative, an online conversion, was built and then abandoned; section 7 says why.

## 3. What bounds a client-side encrypted index in a browser

Each claim carries one label. **Hard** is fixed by a specification or an engine constant. **Measured** was
run, on the engine and machine named in section 5. **Assumption** is believed and not yet established
here, and names the experiment that would settle it.

| #   | Claim                                                                                                                                                                                                                                                      | Label                                                                                                                                                                                                                          | Source                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | The V8 pointer-compression cage is 4 GiB and caps old space; the default maximum old generation is `clamp(physical_memory / ratio, 256 MB, 4 GB)`, with ratio 2 on 64-bit desktop and 4 on Android                                                         | Hard                                                                                                                                                                                                                           | [`v8-internal.h`](https://github.com/v8/v8/blob/main/include/v8-internal.h), [`heap.cc`](https://github.com/v8/v8/blob/main/src/heap/heap.cc)                                                       |
| B2  | Exceeding the heap is an uncatchable process abort (`FatalProcessOutOfMemory` to `abort()`), not a JS exception, so an eviction policy cannot be reactive and the bound must be a static self-accounting budget in bytes                                   | Hard                                                                                                                                                                                                                           | [`heap.cc`](https://github.com/v8/v8/blob/main/src/heap/heap.cc), [v8-users](https://groups.google.com/g/v8-users/c/vKn1hVs8KNQ)                                                                    |
| B3  | A Web Worker does not raise the memory budget: since V8 9.2 all isolates in a process share one 4 GiB cage                                                                                                                                                 | Hard                                                                                                                                                                                                                           | [v8.dev/blog/v8-release-92](https://v8.dev/blog/v8-release-92)                                                                                                                                      |
| B4  | `ArrayBuffer` and `TypedArray` backing stores live outside the cage; plain objects, strings, `Map` and `Set` do not                                                                                                                                        | Hard                                                                                                                                                                                                                           | [`v8-internal.h`](https://github.com/v8/v8/blob/main/include/v8-internal.h), [V8 sandbox README](https://chromium.googlesource.com/v8/v8.git/+/refs/heads/main/src/sandbox/README.md)               |
| B5  | `await crypto.subtle.decrypt` is not a yield point: AES-GCM, SHA, HMAC, HKDF, ECDH and ECDSA all run synchronously on the calling thread in Chromium, with no size threshold and no thread hop (only RSA key generation and PBKDF2 are posted elsewhere)   | Hard                                                                                                                                                                                                                           | [`webcrypto_impl.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/webcrypto/webcrypto_impl.cc)                                                                      |
| B6  | A long task is anything over 50 ms; INP is good at 200 ms or less; chunking guidance is a 50 ms deadline per chunk                                                                                                                                         | Hard                                                                                                                                                                                                                           | [Long Tasks](https://w3c.github.io/longtasks/), [CWV thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds), [optimize long tasks](https://web.dev/articles/optimize-long-tasks) |
| B7  | Neither `navigator.storage.estimate()` nor `performance.measureUserAgentSpecificMemory()` can be used for policy in Element: the first is deliberately padded, the second needs cross-origin isolation that Element's CSP forecloses                       | Hard                                                                                                                                                                                                                           | [estimating storage](https://developer.chrome.com/blog/estimating-available-storage-space/), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)     |
| B8  | Storage eviction deletes an entire origin at once and skips origins granted persistence; Safari ITP deletes script-writable storage after 7 days without a first-party interaction                                                                         | Hard                                                                                                                                                                                                                           | [MDN quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [WebKit tracking prevention](https://webkit.org/tracking-prevention/) |
| B9  | Evicting the origin destroys the session, not just the index: the pickle key and the rust crypto store share it. `navigator.storage.persist()` is therefore required, and the current code does not call it                                                | Hard for the mechanism, inferred for the consequence                                                                                                                                                                           | as B8, plus `apps/web/src/utils/tokens/pickling.ts`                                                                                                                                                 |
| B10 | Chrome externalises IndexedDB values above 64 KiB into blob files; Firefox above 1 MiB; AES-GCM amortises its per-call cost by about 16 KiB and is throughput-bound by about 256 KiB. The intersection is a chunk of 32 to 64 KiB, roughly 50 to 90 events | Hard for the thresholds, inferred for the intersection                                                                                                                                                                         | Chromium and Gecko constants; AES-GCM measured on Chromium 149                                                                                                                                      |
| B11 | The crawler cannot reach these corpus sizes in one sitting: `EVENTS_PER_CRAWL` is 100 and the default sleep is 3000 ms, so 2,000 events per minute, which is 100 minutes for 200k and 8.3 hours for 1M                                                     | Hard, from the constants in `EventIndex.ts` and `Settings.tsx`                                                                                                                                                                 | the code                                                                                                                                                                                            |
| B12 | Cold restore is linear in the number of indexed events and about two thirds of it is one uninterruptible main-thread task                                                                                                                                  | Measured                                                                                                                                                                                                                       | section 5                                                                                                                                                                                           |
| B13 | Resident heap is 869 to 914 B per indexed event in Chrome for the real record shape, close to a per-event constant rather than proportional to message length                                                                                              | Measured (no GC bracket, so about 10% error)                                                                                                                                                                                   | section 5                                                                                                                                                                                           |
| B14 | The JS rebuild (base64 decode, `JSON.parse`, `tokenize`, `Map`/`Set` inserts, one sort per room) is the largest restore bucket at every size and no storage layout removes it                                                                              | Measured                                                                                                                                                                                                                       | section 5                                                                                                                                                                                           |
| B15 | Real vocabulary follows Heaps' law and never saturates, so the cost of the vocabulary walk in `lookupToken` keeps growing; `tokenize` keeps `\p{N}`, which inflates it further                                                                             | Hard as an empirical law, inferred for this tokeniser                                                                                                                                                                          | [Heaps' law](https://nlp.stanford.edu/IR-book/html/htmledition/heaps-law-estimating-the-number-of-terms-1.html)                                                                                     |
| B16 | A CJK message tokenises to exactly one token, because the splitter breaks on anything that is not `\p{L}`, `\p{N}` or `_`, so every mid-sentence CJK query falls to the substring scan                                                                     | Hard, from `tokenize`                                                                                                                                                                                                          | the code                                                                                                                                                                                            |
| B17 | An unpaged `getAll` roughly doubles peak memory during restore, because the array of every ciphertext row stays reachable across the whole decrypt loop                                                                                                    | Assumption for the unpaged case; **the paged case is now Measured**: with schema v3's paged chunk reads, peak heap during restore is 1.0001x to 1.033x settled heap at 200k and 500k, against the 15% the experiment asked for | `loadAllForUser`; section 7                                                                                                                                                                         |
| B18 | Element's own baseline heap without the index is 150 to 400 MB                                                                                                                                                                                             | Assumption. Experiment: load Element with the flag off, sync a real account, idle, GC, read the heap                                                                                                                           | none yet                                                                                                                                                                                            |
| B19 | A mid-range laptop is about 2.5x slower than the machine in section 5                                                                                                                                                                                      | Assumption for real hardware. The proxy experiment has run: at 4x CPU throttling no phase scales by a flat 4x, and hydration settles at 3.45x (section 5)                                                                      | section 5                                                                                                                                                                                           |

Applying B1, B13 and B17 gives the per-platform budget. "25% budget" is the share of the maximum old
generation this feature may claim, which is the honest figure rather than 50%, because Element's own
baseline (B18), the rust crypto store's WASM memory and the js-sdk's caches draw on the same process.

| Platform                                 | Old-generation ceiling                                 | 25% budget              | Resident events at 0.9 KB | 200k today, peak share            | Verdict at 200k today                                 |
| ---------------------------------------- | ------------------------------------------------------ | ----------------------- | ------------------------- | --------------------------------- | ----------------------------------------------------- |
| Desktop Chrome or Edge, 8 GB RAM or more | 4 GiB                                                  | 1.0 GiB                 | ~1.1 M                    | 10%                               | memory is fine, time is not                           |
| Desktop Chrome 4 GB RAM; Android 8 GB    | 2 GiB                                                  | 512 MiB                 | ~560 k                    | 20%                               | memory is fine, time is not                           |
| Android 6 GB                             | 1.5 GiB                                                | 384 MiB                 | ~420 k                    | 27%                               | marginal                                              |
| Android 4 GB                             | 1 GiB                                                  | 256 MiB                 | ~280 k                    | 41% before Element's own baseline | not viable unpaged; needs a hot window of 100 to 150k |
| Firefox, any RAM                         | 4 GiB cap, SQLite backend                              | as desktop              | as desktop                |                                   | as desktop; `scheduler.yield` from 142                |
| Safari and iOS                           | no constant, jetsam instead, plus ITP storage deletion | treat as the small tier |                           |                                   | unmeasured                                            |

The binding constraint is therefore split: on desktop it is **time** (B12, B14), on mobile it is **memory**
(B1, B13, B17). A design that fixes only one of them is not a design.

## 4. Prior art

Nine products were read at source for how they search over end-to-end encrypted data on the client.
"Resident" means the whole index must be in RAM to answer a query.

| Product                                  | Where the index lives                                                                       | Encryption granularity                                                                      | Memory bound                                                  | Load strategy                                                                                                  | Degradation policy                                                                               | Source                                                                                                                                                                                           | Status   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Proton Mail Encrypted Search (browser)   | IndexedDB, five stores, metadata and content split                                          | per item, AES-GCM-128, key wrapped under the account key; `timepoint` cleartext and indexed | 600 MB cache, not resident                                    | `initializeES` reads a few status rows and returns; the cache fills on first search and search runs against it | oldest-first eviction, content before metadata; "For messages newer than {date}"                 | [ProtonMail/WebClients](https://github.com/ProtonMail/WebClients) `packages/encrypted-search`, [engineering post](https://proton.me/blog/engineering-message-content-search)                     | verified |
| Keybase chat (native)                    | one encrypted row per `(convID, token)`                                                     | NaCl secretbox per postings row; record name is `HMAC(key, token‖convID‖uid‖domain)`        | LRUs of 10,000 / 3,000 / 500 plus a 20,000-entry dirty buffer | deferred 10 s desktop, 20 s mobile, then every 5 to 15 minutes                                                 | 100 conversations desktop, 10 mobile, priority-ordered; caps of 10,000 hits and 100,000 messages | [keybase/client](https://github.com/keybase/client) `go/chat/search`                                                                                                                             | verified |
| Tuta web                                 | IndexedDB, `SearchIndexMetaOS` keyed by the **encrypted word**                              | per entry, AES-256; meta rows concatenated per word                                         | nothing resident; read per term, then narrow                  | index read on demand per term                                                                                  | 28 days free, 365 days paid; `lastReadSearchIndexRow` cursor                                     | [tutao/tutanota](https://github.com/tutao/tutanota) `doc/search.md`                                                                                                                              | verified |
| Skiff Mail (discontinued)                | one MiniSearch blob in IndexedDB, in a Worker                                               | one random key over the whole blob                                                          | **resident**, necessarily                                     | whole blob decrypted and parsed at unlock                                                                      | 50 per page, 10 on iOS                                                                           | [skiff-org/skiff-apps](https://github.com/skiff-org/skiff-apps)                                                                                                                                  | verified |
| Signal Desktop and Session               | FTS5 table inside the SQLCipher file                                                        | per SQLCipher page                                                                          | never loaded                                                  | none: the DB is the index                                                                                      | query-time caps of 100 in-conversation and 500 global                                            | [signalapp/Signal-Desktop](https://github.com/signalapp/Signal-Desktop)                                                                                                                          | verified |
| Seshat (Element Desktop)                 | Tantivy on disk plus a SQLCipher metadata DB                                                | per Tantivy file, AES-256-CTR and HMAC                                                      | 50 MB writer budget; 100-entry pagination LRU                 | opened on demand                                                                                               | commits at 500 events or 5 s                                                                     | [matrix-org/seshat](https://github.com/matrix-org/seshat)                                                                                                                                        | verified |
| matrix-sdk-search (Element X)            | per-room Tantivy directory on disk                                                          | inherited from Seshat                                                                       | 50 MB writer budget per room                                  | indexes off the event-cache update stream                                                                      | stated policy: 3 months in the 100 most recent rooms, breadth-first by week                      | [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk), [element-meta#3252](https://github.com/element-hq/element-meta/issues/3252)                                                    | verified |
| Delta Chat, Wire webapp, Threema Desktop | no index at all, `LIKE` or regex scan                                                       | n/a                                                                                         | n/a                                                           | n/a                                                                                                            | hard caps of 1,000 / 30 / 5 results                                                              | [deltachat-core-rust](https://github.com/deltachat/deltachat-core-rust), [wire-webapp](https://github.com/wireapp/wire-webapp), [threema-desktop](https://github.com/threema-ch/threema-desktop) | verified |
| Beeper                                   | FTS5, trigger-populated                                                                     | not published                                                                               | not published                                                 | progressive background indexing on account-add                                                                 | 20 items per page                                                                                | [developers.beeper.com](https://developers.beeper.com)                                                                                                                                           | inferred |
| **Element Web #34718, as the PR ships**  | IndexedDB, one AES-GCM record per event; the inverted index is rebuilt in RAM on every load | per event                                                                                   | **resident and uncapped**                                     | fully awaited before the client starts                                                                         | none: `fullCrawl`, offset paging, no cap                                                         | this repository                                                                                                                                                                                  | verified |

That last row is the pull request as it stands, which is what a reviewer reads. Section 7 records where
the increments have moved it since: chunked AES-GCM records, a bounded resident set over a durable store
that holds more than RAM does, a recency directory that is readable without decrypting bodies, batched
writes, a crawl bound by recency and room count, and nothing on the app-start path. Those are converged
practices 2 to 7 and they are built; practices 1, 8 and 9 arrived with increment E, practice 1 in its
resume half only, since what shipped bounds a page by wall clock and hands back a session token rather than
capping the number of pages.

The practices shared by three or more independent products (a fork counts as one product with its parent)
are the converged pattern:

1. Cap the output at query time and return a resume cursor. Never scan to exhaustion. Nine products, no
   exceptions. This is the most universal practice in the survey and the cheapest to adopt.
2. The durable store is the source of truth; RAM holds a bounded, disposable subset. Six products. Skiff is
   the only counter-example and it is discontinued.
3. Encrypt at the granularity you retrieve at, so a query decrypts only what it touches. Five products. The
   failure mode is visible in Skiff (one blob, therefore fully resident) and in
   [seshat#21](https://github.com/matrix-org/seshat/issues/21), where `open_read()` decrypts whole files
   into RAM.
4. Make ordering and lookup work without decrypting: a cleartext timepoint with an index, an HMAC'd record
   name, an encrypted word as the object-store key. Four products, four mechanisms, one idea. Something must
   be in the clear or keyed, or every access degrades to a full scan, which is exactly why #34718 must hold
   everything in RAM.
5. Batch reads, writes and decrypts, with the batch size as a named constant. Five products. Nobody does one
   record per transaction.
6. Bound the input by recency and by container count, as named constants. Four products, two of which land
   on 100 containers, and both add priority or recency ordering on top of the cap.
7. Nothing about search sits on the app-start critical path. Four products, and Element's own published plan
   for Element X makes five.
8. Search must return useful results from a partial index, and stream them. Four products. Partial is the
   normal state, not an error state.
9. Degrade oldest-first and in tiers, not all-or-nothing. Three products, and two of them split their store
   in two specifically so the cheap tier can survive the expensive one.
10. Shrink the expensive path on low-memory platforms rather than slowing it down everywhere. Five products.
11. Do your own memory accounting; do not ask the platform. Three products, one of which deliberately
    over-estimates and uses that estimate as the only input to its cap.
12. Expect the index format to churn and make migration a reset and rebuild. Three products. #34718's
    v1-to-v2 reset is the mainstream choice, not a shortcut.

What does not converge, and should not be claimed: a user-visible "still indexing" UI (it converges in mail,
not in chat, so shipping the "newer than {date}" line puts Element ahead of every messenger surveyed rather
than behind), the choice between an inverted and a forward index (genuinely split, and it correlates with
corpus size and with whether the platform hands you FTS5 for free), and Web Workers (the largest browser
deployment runs entirely on the main thread).

### Searchable symmetric encryption does not apply

Searchable symmetric encryption, from Song-Wagner-Perrig onwards, solves _server-side_ search: a client
holding the key wants an untrusted server to run queries over ciphertext it cannot read, and the whole
apparatus of trapdoors, oblivious access and leakage functions exists to constrain what the server learns.
Our situation is the inverse. The client holds the key, does the search, and the adversary is whoever reads
the local disk afterwards, so there is no untrusted party in the query path to protect against. Proton, who
looked at this hardest, parked it as future work "if it proves viable and necessary"
([engineering post](https://proton.me/blog/engineering-message-content-search)). The relevant literature
here is ordinary encrypted-at-rest paged storage, which is what every product in the matrix above uses.

## 5. Performance evaluation

### Method

The method of record is a **synthetic corpus framework driven through the real manager in a real browser**,
not a measurement of one real account. A real account is a sample of one whose size we cannot choose, and an
earlier attempt to argue corpus sizes from published Matrix statistics produced numbers that did not survive
review. A generator we can calibrate and re-run at four sizes gives slopes, and slopes are what the design
needs.

What the harness does:

- **Real record shapes.** Events carry the exact fields `EventIndex.ts`'s `eventToJson()` adds for an
  encrypted event (`curve25519Key`, `ed25519Key`, `algorithm`, `forwardingCurve25519KeyChain` on top of
  `unsigned`), plus edits (2%), file attachments (3%) and reply relations (5%), so the code paths that
  handle them are exercised and the per-event byte cost is real.
- **Zipfian rooms and vocabulary.** Room sizes follow a Zipf distribution (exponent 1.0) rather than an even
  split, so one room dominates. Message length is lognormal with a median of 10 words, word frequency is
  Zipfian (exponent 1.05), the vocabulary is sized by Heaps' law (K = 21, beta = 0.55), and 10% of messages
  are accented Latin and 5% are CJK.
- **Backward crawl order.** Events are delivered through `addHistoricEvents()` in batches of 100
  (`EVENTS_PER_CRAWL`), newest-undelivered-first per room, rooms round-robin, exactly as the crawler does.
  This matters: `addEventToIndex()`, the live-timeline API, always appends and never pays the
  backward-insert cost that the crawler's callers do. Switching to crawl order with concentrated rooms
  raised the measured write cost by 237% at 20k (in the Node harness, where only the ratio is meaningful),
  while restore moved by 8.5%, because `loadAllForUser` appends in key order and sorts each room once at
  the end.
- **Real Chromium, real IndexedDB, real WebCrypto.** The unmodified `BrowserEventIndexManager.ts` is bundled
  into a page and driven through Playwright, so storage and crypto are the engine's own. Node with
  `fake-indexeddb` is kept only for quick before-and-after checks and never quoted as a browser number.
- **One fresh profile per size, cold restore in a separate process.** Each size gets its own persistent
  profile. Ingest and drain run in one browser process; the profile is then reopened by a **second process
  launch**, so `initEventIndex()` is a genuinely cold read of real on-disk state rather than a page reload.
- **Instrumentation inside the page, installed before the module loads.** `getAll` and
  `crypto.subtle.decrypt` are wrapped for their own timings, a `PerformanceObserver` on `longtask` is reset
  immediately before the restore, and on-disk size is read with `du` over the profile's IndexedDB directory,
  never from `navigator.storage.estimate()` (B7).

Engine and machine: Chrome for Testing 149.0.7827.55, headless, launched by explicit `executablePath` from
the checkout's own `playwright-core` so driver and browser cannot differ. WSL2 on Linux x86_64, 12 cores, 47
GiB RAM. Sizes ran sequentially, never in parallel.

### Known limitations

These are named because they bound what the numbers can be used for.

- **One fast desktop for the baseline table.** No mid-range laptop and no mobile. Absolute times are
  floors; the slopes and the ratios are the transferable part. Firefox and WebKit have since been measured
  and are reported separately below, and 4x CPU throttling stands in for slower hardware; a real laptop and
  a real phone are still unmeasured, so B19 remains an assumption about hardware.
- **The vocabulary sampler in the baseline runs could not sustain Heaps' law within one run.** That
  generator picks one target vocabulary from Heaps' law for the corpus's final size and then Zipf-samples
  every message from that fixed pool. The final vocabulary lands within 2 to 13% of the target at every
  size, so it is correctly sized _across_ runs, but the fitted within-run exponent falls from 0.542 at 20k
  to 0.398 at 200k as the corpus runs out of new words. Real vocabulary never saturates (B15), so the token
  and prefix query numbers in the baseline tables below are **underestimates** at scale. The substring and
  memory numbers do not depend on vocabulary and are unaffected. This limitation is now fixed, by the
  streaming Pitman-Yor generator described under cross-engine results; the fixed-pool generator remains the
  default so that every earlier measurement stays comparable.
- **Heap without a GC bracket.** `performance.measureUserAgentSpecificMemory()` does its own accounting and
  no explicit collection was forced. The slope is consistent across four sizes, so about 10% is the
  plausible error.
- **Disk measured immediately after a write burst**, with no idle time for LevelDB compaction, so it is
  "disk right after a crawl" and not a steady state. Chrome 150 replaces LevelDB with SQLite and the
  measurement will have to be repeated there.
- **The baseline tables measure the design as the PR first shipped it**, before any of the increments in
  section 7. Read them as the starting point the increments are measured against, not as what the code does
  now. Absolute figures are only comparable within one harness generation: the harness used for the
  increment-C and increment-D runs samples `measureUserAgentSpecificMemory()` during the restore it is
  timing, and that call blocks on a full garbage collection, which inflates the restore times it reports.
  Section 7 names the harness behind every figure for that reason.

### Results

Ingest, write drain and cold restore, at four sizes. `records` is lower than the requested corpus size
because about 2% of generated events are edits, which update a record rather than creating one.

| Requested | Records | Ingest (ms) | Persist drain (ms) | IndexedDB transactions during ingest / drain | Cold restore (ms) | Disk after ingest (MiB) |
| --------- | ------- | ----------- | ------------------ | -------------------------------------------- | ----------------- | ----------------------- |
| 20,000    | 19,598  | 493         | 40,127             | 1 / 20,399                                   | 1,460             | 87.9                    |
| 50,000    | 48,956  | 457         | 93,355             | 1 / 51,013                                   | 3,330             | 156.8                   |
| 100,000   | 97,982  | 1,090       | 74,395             | 1 / 102,001                                  | 7,072             | 276.7                   |
| 200,000   | 196,113 | 2,244       | 148,614            | 1 / 203,971                                  | 15,393            | 471.9                   |

The transaction column is the first surprise: essentially none of the writes happen while the crawler's own
awaited loop runs, because `enqueuePersist()` chains them as fire-and-forget promises. The cost lands later,
in the drain, which also means a crash mid-crawl loses more than "the crawler is slow" suggests.

Where the restore time goes, and what it blocks:

| Records | Restore (ms) | `getAll` wait (ms) | `subtle.decrypt` (ms) | JS rebuild (ms) | Rebuild share | Longest single task (ms) | Longest task as a share of restore |
| ------- | ------------ | ------------------ | --------------------- | --------------- | ------------- | ------------------------ | ---------------------------------- |
| 19,598  | 1,460        | 395                | 268                   | 798             | 54.6%         | 959                      | 65.7%                              |
| 48,956  | 3,330        | 898                | 604                   | 1,827           | 54.9%         | 2,269                    | 68.1%                              |
| 97,982  | 7,072        | 2,027              | 1,366                 | 3,679           | 52.0%         | 4,718                    | 66.7%                              |
| 196,113 | 15,393       | 4,005              | 2,938                 | 8,451           | 54.9%         | 10,740                   | 69.8%                              |

There are consistently two long tasks per restore, not one, and their sum accounts for the restore minus the
`getAll` wait to within 0.3%. The accurate statement is therefore: cold restore is an asynchronous IndexedDB
read wait (30 to 34%, which correctly does not block the main thread) plus one dominant uninterruptible
main-thread task (66 to 70%) that B5 prevents from yielding. Because `Lifecycle` awaits
`EventIndexPeg.init()` before `MatrixClientPeg.start()`, that task is a frozen application before sync: 1.5 s
at 20k and 15.4 s at 200k on this machine, and B19 would project roughly 38 s at 200k on a laptop.

Heap, and query latency (median of 20 warm queries per category):

| Records | Heap after restore (MB) | Bytes per event | Token (ms) | Prefix (ms) | Substring (ms) | Miss (ms) |
| ------- | ----------------------- | --------------- | ---------- | ----------- | -------------- | --------- |
| 19,598  | 20.2                    | 913.7           | 1.15       | 0.88        | 6.14           | 4.69      |
| 48,956  | 45.6                    | 885.1           | 1.50       | 1.05        | 10.76          | 8.00      |
| 97,982  | 88.5                    | 879.4           | 4.00       | 2.78        | 24.56          | 20.33     |
| 196,113 | 172.7                   | 869.1           | 8.79       | 6.16        | 48.81          | 36.70     |

Bytes per event is measured against an empty page carrying the same bundle, so the bundle and V8 startup heap
are excluded. The substring fallback is the query ceiling: at 200k it is 48.8 ms median with a 62 ms worst
sample, which is already at the 50 ms long-task threshold (B6), and it is what every CJK query pays (B16).
Token and prefix stay in single digits, but the vocabulary caveat above means those two columns are the
optimistic ones.

On-disk size is 3.4x to 6.4x the manager's own ciphertext accounting (138.6 MiB accounted versus 471.9 MiB on
disk at 200k), falling as n grows. Four multipliers stack: base64 in JSON (1.33x on the ciphertext, plus the
`iv` and the JSON envelope), the record key stored twice (once in the store, once in the `byUser` index),
Snappy being unable to compress ciphertext, and 200k separate transactions leaving many small unmerged
LevelDB tables. The falling ratio is the signature of fixed and uncompacted overhead amortising, so treat
2.4 KB per event as a write-burst peak and not a steady state, and do not size a disk budget on it.

### Cross-engine results, and a corpus generator that sustains Heaps' law

A later run took the code as deployed (increments A, B and C of section 7) to Firefox 151 and WebKit 26.5
alongside Chromium, on the same machine, and added a 4x CPU-throttled Chromium configuration. Two changes
to the harness were needed first.

The vocabulary sampler was replaced, optionally, by a streaming Pitman-Yor process: at each token draw an
existing type is chosen with probability proportional to its count less a discount, and a brand-new type
with probability proportional to the concentration plus the discount times the number of live types. The
construction has no saturation point by design, the number of distinct types grows as a power law of the
token count forever, and the frequency distribution it induces is asymptotically Zipfian, so the word-shape
property the old sampler had is kept rather than traded away. A Fenwick tree keeps a single draw at
O(log V). Fitted with the manager's own `tokenize()`, the exponent is flat where the old one collapsed.

| Events  | Fitted beta, streaming Pitman-Yor | Fitted beta, fixed pool | Distinct tokens at the end |
| ------- | --------------------------------- | ----------------------- | -------------------------- |
| 20,000  | 0.573                             | 0.542                   | 12,361                     |
| 100,000 | 0.569                             | 0.497 at 50k            | 30,690                     |
| 200,000 | 0.560                             | 0.398                   | 44,428                     |

The second change is that two of the harness's instruments do not exist outside Chromium.
`measureUserAgentSpecificMemory()` and `performance.memory` are both Chromium-only, so Firefox and WebKit
are reported with the whole engine's RSS instead, which is a strictly coarser number and is never presented
as equivalent to a JS-heap figure. More awkwardly, **`PerformanceObserver({type: "longtask"})` neither
throws nor ever emits an entry on Firefox or WebKit**, so an empty long-task list on those engines is not
evidence that no long task occurred; the harness reports a self-rescheduling zero-delay timer watchdog as
a cross-engine upper bound instead, which folds ordinary timer jitter into its answer and is therefore an
upper bound and not a task-boundary measurement. CPU throttling goes through CDP and so is Chromium-only;
the harness refuses the flag on the other two engines rather than ignoring it.

At 200k requested events, with the sustained-Heaps'-law corpus:

| Metric                                 | Chromium                     | Chromium, 4x throttle         | Firefox 151                | WebKit 26.5                 |
| -------------------------------------- | ---------------------------- | ----------------------------- | -------------------------- | --------------------------- |
| Tier selected                          | desktop (128 MiB)            | desktop                       | **small (48 MiB)**         | **small (48 MiB)**          |
| Resident `eventCount`                  | 131,072                      | 131,072                       | 49,152                     | 49,152                      |
| Ingest (ms)                            | 7,324.8                      | 18,380.1                      | 7,830.7                    | 4,068.1                     |
| Write drain (ms)                       | 148,105.8                    | 162,199.2                     | 169,492.9                  | 132,044.5                   |
| On-disk size (MiB)                     | 532.92                       | 527.59                        | 895.36                     | 355.13                      |
| `initEventIndex()` (ms)                | 132.8                        | 93.9                          | 8.8                        | 9.3                         |
| Manifest load (ms)                     | 1,194.3                      | 2,991.9                       | 863.3                      | 799.9                       |
| Hydration (ms)                         | 21,342.2                     | 73,572.5                      | 21,374.0                   | 12,739.2                    |
| Token / prefix / substring / miss (ms) | 2.50 / 1.23 / 39.31 / 29.19  | measured at 20k and 100k only | 0.38 / 0.32 / 11.76 / 9.12 | 0.80 / 0.44 / 18.08 / 16.18 |
| Longest task or span (ms)              | 258.9 watchdog, 0 long tasks | 51 to 76, three long tasks    | 94.4 watchdog only         | 69.5 watchdog only          |

**No engine failed at any size**, and the write-path difference between engines is real but modest, about
30% across the full 200k ingest and drain, with WebKit fastest and Firefox slowest. Everything else in that
table has to be read through one finding.

**`navigator.deviceMemory` is Chromium-only, so every Firefox and WebKit desktop user silently lands in the
small tier.** The tier heuristic treats an absent `deviceMemory` as the conservative answer, which is right
for an unknown mobile and wrong for a 48 GiB desktop: Firefox and WebKit hold 49,152 resident events where
Chromium holds 131,072, less than four tenths as much searchable text, on the same machine and the same
corpus. Their lower query latencies follow from that and not from a faster query path, since substring and
miss are the two categories that scale with resident text. The fix, which reads an absent `deviceMemory`
together with a non-mobile user agent as the desktop tier, was the first item of increment E and has since
shipped, so the table above records the behaviour before it rather than a live property of the deployment.

The throttled column also answers B19's proxy experiment, and the answer is that **no phase scales by a
flat 4x**, so a single laptop multiplier would be wrong whichever value it took:

| n       | Ingest | Write drain | Init  | Manifest | Hydration |
| ------- | ------ | ----------- | ----- | -------- | --------- |
| 20,000  | 7.32x  | 2.49x       | 2.03x | 2.06x    | 3.45x     |
| 100,000 | 3.39x  | 2.60x       | 0.81x | 2.01x    | 2.24x     |
| 200,000 | 2.51x  | 1.10x       | 0.71x | 2.51x    | 3.45x     |

The drain ratio falling to 1.10x at 200k is the informative one: throttling the page's main thread barely
moves a phase whose wall time is by then mostly IndexedDB I/O wait in the browser's own storage process.
Manifest load, a narrow decrypt-bound operation, is the most consistent at about 2x. The sub-1x init
figures are single samples of a 60 to 133 ms window and are noise. Hydration settling at 3.45x at both ends
of the size range is the number worth carrying forward for estimating slower hardware, since hydration is
the phase dominated by the decrypt, parse, tokenise, insert and sort loop.

### The three coefficients that drive the design

| Coefficient                     | Value at 200k                                                                            | What it forces                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore cost per indexed event  | 78.5 µs total, of which 58.1 µs blocks the main thread and **43.1 µs is the JS rebuild** | The rebuild is not removable by any storage layout (B14), so the only lever is to rebuild less. Hence a bounded hot window, and slices rather than one task. A packed binary format lands the total at roughly 48 µs per event, a 1.6x improvement, which is worth having for the write path and the peak but does **not** fix the load. |
| Resident heap per indexed event | 869 to 914 B; the 44% postings and 56% payload split is inferred, not measured           | The resident set must be budgeted in **bytes**, statically, per platform tier (B2), and the tier must default to small when `navigator.deviceMemory` is absent. 200k resident events are 41% of an Android 4 GB device's budget before Element's own baseline.                                                                           |
| Scan cost per resident event    | 0.25 µs (48.8 ms at 200k)                                                                | Any full scan of resident text must be deadline-sliced, streamed and cancellable, and every query must be capped with a resume cursor. This is the per-keystroke ceiling, and for CJK it is the only path.                                                                                                                               |

A fourth measured cost is not a design driver but is worth stating: one IndexedDB transaction per event costs
0.74 to 2.0 ms per event on the drain, which is 150 s of writes for a 200k corpus. Against a 3,000 ms crawler
sleep that is a 2% duty cycle, so batching the writes is hygiene rather than a user-visible win, but it is
also close to free.

## 6. Target architecture, and why each part is there

In five lines:

1. **Disk holds everything retained**, as packed AES-GCM chunks of 50 to 90 events (32 to 64 KiB) with a
   separately encrypted small header, binary values, and one global chunk sequence.
2. **RAM holds an identity layer for everything on disk** (ids, timestamps, room index; roughly 100 B per
   event) plus a **hot window** of the newest events with full postings and payload, sized in bytes per
   platform tier.
3. **Load is O(1) on the start path.** The hot window hydrates newest-first in 30 ms deadline slices, with
   search available throughout.
4. **Query is the hot-window inverted index first**, then a streamed forward scan of the cold tier
   newest-first, capped at two pages with a resume cursor and cancelled on the next keystroke.
5. **Every bound is a named constant**: crawl window and room cap for the input, hot-window bytes for RAM,
   disk bytes for storage, page cap for queries. Eviction is oldest-first by timestamp, and dropping means
   deleting.

**Storage layout.** Two lanes: a header lane carrying `minTs`, `maxTs`, `roomId`, `n` and `eventIds`, and a
body lane carrying the events, both encrypted, both `Uint8Array`, both AAD-bound to their key. The design
sketched them as two object stores under the same key `[userId, chunkId]`; what was actually built keeps
the body lane as a `chunks` store on exactly that key and realises the header lane as the encrypted recency
manifest in the existing `meta` store, which arrived one increment earlier and already held the same
information for every row on disk. Section 7 records why that turned out to be the better shape. Cleartext residue shrinks to `userId`, `chunkId` and the ciphertext length, which
takes `eventId` out of the clear and closes the leak the current threat model has to admit (section 2). The
header lane is what makes recency order and identity readable without touching bodies, which coefficient 1
demands. Chunk size follows B10, not a round number of events: 1,000 events per chunk would be deep into
Chrome's externalised-blob regime. `chunkId` is one global sequence and never per-room ranges, because
ranges would reopen the room-count leak. Mutation (redaction, edit folding) is a chunk rewrite, trivial at
human rates. Key derivation is unchanged: the index still dies with the session, which is a deliberate
divergence from Proton and worth keeping. Migration from v2 is a reset and re-crawl, per converged practice 12. Precedent: Proton's metadata and content split, 1Password's overview and details tiers, Tuta's meta and
index stores, Keybase's HMAC'd record names (practices 3 and 4).

**What is resident.** The identity layer covers every event on disk, so `events.has(id)` is exact from the
moment the headers are read: that keeps the crawler's termination oracle and `isEventIndexEmpty()`
independent of how much is hydrated, which is what makes "dropping means deleting" safe. Typed arrays for the
timestamp and room columns also put that part of the cost outside the 4 GiB cage (B4). Full postings and
payload exist only inside the hot window, filled newest-first until a byte budget is reached, because
coefficient 1 says the rebuild is the cost and coefficient 2 says the bytes are the bound.

**Load path.** Open the database, read `meta`, derive keys, answer emptiness with `getKey(userId)` rather
than a scan (never `count()`, which is O(n)), `getAll` the chunk headers, build the identity layer, return.
Sync starts; time-to-interactive no longer depends on n. Hydration then reads pages of about 64 chunks over a
key range, releasing each page before the next (B17), and decrypts and rebuilds in **deadline-boxed 30 ms
slices** with `scheduler.yield()` and a `setTimeout(0)` fallback. Boxing by deadline rather than by count is
deliberate: per-event cost varies about 2x with message shape. Reading the headers costs roughly 35 ms at
200k and 175 ms at 1M, which is why an encrypted header beats putting a coarse time bucket in the clear.
Slicing rather than a Worker is the recommendation: a Worker moves the block without adding budget (B3), and
the largest browser deployment in the survey runs on the main thread. Precedent: Proton's `initializeES`,
Keybase's deferred start (practice 7).

**Query path.** Tokenise, walk the hot-window term path (with a sorted vocabulary and binary search, sorted
on demand after inserts, which B15 makes necessary at these sizes), and if the hits are fewer than twice the
limit, continue into the cold tier: page chunk headers newest-first, decrypt, scan, in the same 30 ms slices,
streaming partial results every 200 ms or so, stopping at two pages, returning a `next_batch` cursor and
aborting on the next keystroke. (What was built keeps the newest-first streamed scan and the abort, and
replaces the cursor and the page cap with a wall-clock budget per page and an opaque session token: section 7,
increment E.) The predicted cold-scan cost is about 5 µs per event (1.2 read, 3.5 decrypt,
0.25 scan), so roughly 1 s for 200k cold events on this machine, streamed. The substring and CJK path is
bounded by the same slices and never silently disabled. Precedent: Proton's `hybridSearch` and
`uncachedSearch`, and the query cap that all nine products share (practices 1 and 8).

**Crawl bound.** A `shouldCrawl(checkpoint)` hook on `BaseEventIndexManager`, defaulting to true, consulted
before `createMessagesRequest` and by `addInitialCheckpoints`. This is the one piece that needs shared code
(about fifteen lines in `EventIndex.ts`), because `fullCrawl` currently ignores what the manager thinks.
Policy lives in named constants: a recency window, a room cap ordered by last activity, and breadth-first by
week across rooms, which is what [element-meta#3252](https://github.com/element-hq/element-meta/issues/3252)
already specifies for Element X, and which is what makes a partial index useful after the first pass, since
every room then has its last week. B11 is the reason this is mostly a policy about what is _kept_ rather
than what arrives.

**Eviction.** Priority is a timestamp property of the chunk (`maxTs`), never `chunkId`, because crawl order
is not recency after an offline return or a late join. Two tiers, oldest-first: first hot-window residency
(drop postings and payload, keep identity), then disk chunks beyond the disk budget or outside the crawl
window (delete from both stores). Dropping means deleting, so no evicted row lingers on disk and the identity
layer stays truthful. Budgets come from the manager's own byte accounting (`ciphertextBytes` is already
exact) and are static and platform-conditional, never reactive (B2) and never from `estimate()` (B7).
`navigator.storage.persist()` is called at init (B9). Precedent: Proton's oldest-first, content-before-
metadata eviction (practice 9) and its hand-rolled accounting (practice 11).

**Multi-tab.** Nothing new is needed. Element's `SessionLock` already elects a single live instance; the
existing `onblocked` rejection and `db.onversionchange` close handler cover the handover window. If a second
primitive is ever needed it should be Web Locks, not `SharedWorker`, which does not exist on Chrome for
Android.

## 7. What has been built

Five increments of section 6 exist as code. Each was implemented against a written proof requirement,
measured in real Chromium on the machine of section 5, and then handed to an adversarial review that ran
its own repros and its own mutation campaign against the branch's test suite rather than reading the
implementer's tests. A mutant counts as killed only when it turns a test red beyond the run's own baseline.
Every increment below is reported with the kill ratio its review reached, because a green suite that
survives its own mutants is evidence of nothing.

| Increment | What it is                                                              | Review verdict           | Where it runs                             |
| --------- | ----------------------------------------------------------------------- | ------------------------ | ----------------------------------------- |
| A         | Non-blocking sliced hydration                                           | SHIP after one fix round | production, on the inblock.io deployments |
| B         | Batched writes, O(1) stats, sorted vocabulary, flat-copy folded memo    | SHIP after one fix round | production, on the inblock.io deployments |
| C         | Crawl window and room cap, byte budgets, the encrypted recency manifest | SHIP after five rounds   | production, on the inblock.io deployments |
| D-core    | Schema v3: binary AES-GCM chunks                                        | SHIP after four rounds   | production, on the inblock.io deployments |
| E         | Cold tier: a streamed scan of the chunks outside the hot window         | SHIP after four rounds   | production, on the inblock.io deployments |

**Deployment status.** All five run on the inblock.io dev and production deployments as a vendored patch,
ahead of upstream, because those deployments had the feature enabled and their users were paying the
blocking restore. A, B and C were carried earlier; D-core and E were promoted together on 2026-09-14,
because D-core resets every existing database and one reset is better than a reset followed immediately by
more churn. Existing databases were therefore reset once, to schema v3: a v2 database is dropped rather than
converted, and the re-crawl that costs is bounded by increment C's crawl window and room cap. None of A to E
is on the pull request branch, which is why `docs/labs.md` describes the feature as the pull request ships it
and not as described here.

### A. Non-blocking sliced hydration

`initEventIndex()` no longer decrypts anything. It reads `meta`, derives the keys, loads the checkpoints
and returns; hydration then runs behind it in deadline-boxed slices that yield through `scheduler.yield()`
with a `setTimeout(0)` fallback. Emptiness is answered with `getKey()` rather than `count()`, which is O(n).
A `loading` bit joins `IIndexStats` and a disjunct joins `useIsIndexIncomplete`, so the existing
`SearchWarning` tells the user the index is still filling, for the file panel as well as for search. Search
runs against whatever is resident at the time, which is the point: partial is the normal state.

The first implementation followed the design's own words, loading the identity set eagerly with one
`getAllKeys()` over the user's key range, and failed its proof. That call is cheap in the sense of never
decrypting anything and expensive in the sense that deserialising every key at 200k is 2,255 ms of work
that lands as one uninterruptible task of 205 ms, with `initEventIndex()` itself at 2,558 ms and scaling
with n. The fix was to delete the eager set: while hydration runs, an id that is not resident might still
be a disk row not yet reached, so one targeted `get()` settles it, bounded by write activity rather than by
n; once hydration has finished, every row has necessarily been visited and the question needs no disk trip
at all. The same exactness, from a boolean the class already maintained.

| Requirement                                     | 20,000 events                      | 200,000 events                      |
| ----------------------------------------------- | ---------------------------------- | ----------------------------------- |
| `initEventIndex()` resolve time                 | 62.4 ms, against 1,460 ms blocking | 46.8 ms, against 15,393 ms blocking |
| Long tasks of 50 ms or more, whole restore      | none                               | none                                |
| Heap once hydration completes, against blocking | 20,146,887 B, 0.04% lower          | 172,915,892 B, 0.13% higher         |
| Query issued 500 ms after init returns          | no error, 211 hits, 41% hydrated   | no error, 158 hits, 4% hydrated     |

One measurement in that run reads like a contradiction and is not. The manager's own instrumentation
reports a slice of 96.6 ms of wall time at 200k while the Long Tasks API reports nothing, because a slice
is not a task: every row awaits `crypto.subtle.decrypt()`, whose continuation is delivered as its own task
in Chromium, so a slice is many short fragments separated by off-main-thread decrypt time. The natural task
boundary at each decrypt is what keeps individual tasks short; the slice deadline is what keeps the event
loop free to paint and handle input between pages. The Long Tasks figure is the one that answers the
requirement.

Review: thirteen findings, of which one blocker (a jest suite the verification command never ran), two high
(a residency race that could enter an event into `roomOrder` twice, and two write-path awaits with no
post-await `closed` check, so teardown could resurrect decrypted events) and the rest medium or lower. All
were fixed and each fix was re-applied as an isolated mutant to confirm it was load-bearing. Mutation
testing: twelve mutants, **six surviving as first submitted and ten of twelve killed after the fix round**,
with the two survivors argued behaviour-equivalent under the new residency guard.

### B. Batched writes, O(1) stats, sorted vocabulary, flat-copy folded memo

No schema change, five independent costs removed. A crawler batch is now one write transaction, and live
events accumulate in a buffer that flushes every 5 s or every 300 events, whichever comes first, so a crash
loses at most one batch or a few seconds of live events rather than corrupting what did commit.
`getStats()` reads `roomOrder.size` instead of walking every resident event, which matters because the
search warning calls it on every checkpoint change. `contextFor` binary-searches a room's position rather
than scanning. The vocabulary is kept as a sorted base plus a small unsorted delta, merged on the write
path once the delta reaches `VOCABULARY_MERGE_THRESHOLD`, so a prefix query binary-searches the base and
linearly scans at most a couple of thousand terms.

| Measure                                        | 20,000 events            | 200,000 events                 |
| ---------------------------------------------- | ------------------------ | ------------------------------ |
| IndexedDB transactions during ingest and drain | 621, from 20,400         | 6,159, from 203,972, 33x fewer |
| Write drain                                    | 3,602 ms, from 40,127 ms | 42,179 ms, from 148,614 ms     |
| Write drain per event                          | 0.184 ms                 | 0.215 ms                       |
| `getStats()` median over 2,000 calls           | 0 ms                     | 0 ms                           |
| Prefix query, quiet index                      | 0.155 ms, from 0.88 ms   | 2.42 ms, from 6.16 ms          |
| Prefix query during hydration                  | not measured             | 2.91 ms, from 34.51 ms         |
| Prefix query during a crawl                    | not measured             | 2.31 ms, from 27.98 ms         |

The drain row is a partial result and is reported as one. The proof requirement was 0.05 ms per event and
the result is four times that. Batching removed the transaction-count component, which was the large one,
and exposed the component underneath it: one `crypto.subtle.encrypt` call per event, roughly 0.2 ms, which
was always being paid and which no amount of transaction batching reduces. Only packing several events into
one ciphertext removes it, which is increment D.

The vocabulary change was itself reviewed twice. A first version sorted lazily, on the read path, which is
an O(V log V) cost per keystroke: measured at 25.4 ms at V of 61,346 and 107.2 ms at V of 200,000, over the
50 ms ceiling at a realistic vocabulary. The shipped base-plus-delta design costs 0.11 ms and 0.01 ms in
the same worst state, with zero calls into the merge from a query. The merge itself now sits on the write
path at 17.28 ms at V of 200,000, growing to roughly 44 ms at 400,000 and 65 ms at 600,000, so it crosses
the long-task ceiling somewhere near V of 450,000. That is inside the project's own million-event target,
so it is named here rather than left to be rediscovered, and hydration already defers it rather than
running it per row.

The folded-text memo went the other way. The limits model projected that memoising folded text would retain
NFKD intermediates worth up to 1,418 B per event on accented Latin text, which argued for deleting the memo
and folding on demand. Measured on a real corpus in a real browser, the hazard is real and an order of
magnitude smaller, and deleting the memo costs far more than it saves:

| Variant at 200k, 50% accented corpus | Heap per event after queries | Substring query median |
| ------------------------------------ | ---------------------------- | ---------------------- |
| Memo, unflattened                    | 940.2 B                      | 46.42 ms               |
| No memo                              | 827.0 B                      | 222.72 ms              |
| Flat-copy memo                       | 929.5 B                      | 44.73 ms               |

The flat-copy memo, which forces the memoised value through `JSON.parse(JSON.stringify(s))` so no sliced or
concatenated parent string is retained, costs 102.5 B per event over no memo and keeps the substring path
at its original latency. It ships. This matters most for CJK users, whose every mid-sentence query falls to
the substring scan (B16), and it is the path they would have paid for with a fivefold latency increase.

Review: two rounds. The first flagged the lazy sort above. Mutation testing: **28 mutants, 21 killed as
shipped and 22 with one added test**, with all six survivors individually argued equivalent in effect. One
of them is worth repeating here because it cannot be fixed by a test: flatness is a heap property, so
nothing in CI can catch a future simplification that deletes `flattenCopy` and silently reinstates the
retention.

### C. Crawl window and room cap, byte budgets, the encrypted recency manifest

This is the increment that bounds the input and the resident set, and it is the one that needed shared
code. `BaseEventIndexManager` gained a `shouldCrawl(checkpoint, clientRoomRank?)` hook that defaults to
true; `EventIndex.addInitialCheckpoints` ranks rooms by `Room.getLastActiveTimestamp()`, which is Element's
own "most recent rooms" order, and passes each room's rank through; and `crawlerFunc` drains every declined
checkpoint in one pass before sleeping once, rather than sleeping once per decline. That is about fifteen
lines of shared code, and it is needed because an initial checkpoint is `fullCrawl` and the crawler ignores
what the manager thinks about it. On top of that sit the hot-window and disk budgets in bytes,
`navigator.storage.persist()` at init, `windowed`, `oldestIndexedTs` and `oldestResidentTs` in the stats,
and the "search covers messages newer than {date}" line.

The design as written did not survive its first review, and the reason is worth recording. Nothing durable
recorded recency independent of what happened to be resident or on disk, so bounded hydration read rows in
event-id order and kept the **oldest** ones, and `shouldCrawl` read its window and cap from the resident
set, which eviction edits. Every one of those five findings had that single root cause.

The fix is the **encrypted recency manifest**: an entry of event id, timestamp and room id for every row on
disk, held resident and persisted as AES-GCM pages in the existing `meta` store under `manifest:<page>`
keys. No new object store, no schema version bump, no reset and no new cleartext beyond a page count. It is
maintained on every write commit, redaction, removal and budget deletion, and only the pages that changed
are re-encrypted. Hydration reads it, sorts each page, and merges the pages with a bounded k-way merge, all
inside the same slices as the rest of hydration; `shouldCrawl` reads it rather than the resident set, so a
room's crawl floor survives that room being evicted from memory; and a database created before the manifest
existed repairs itself with one sliced background scan that also recovers its byte accounting.

Three follow-up findings shaped what shipped. Sorting the whole manifest in one call was a single unsliced
task of 563 ms at 200k and 2,083 ms at 500k, which is what the per-page sort and k-way merge replaced.
Re-encrypting a 10,000-entry page on every flush cost 15.8 ms each time, so `MANIFEST_PAGE_SIZE` dropped to
1,000 and the cost with it, to 1.72 ms, a 9.2x reduction with no correctness trade-off, since only the
still-filling tail page is rewritten per flush. And `oldestIndexedTs` was a cleartext event timestamp that
disclosed to the millisecond when an account's indexed history begins, so it moved into its own encrypted
row.

The fourth finding is a budgeting question that was answered twice. The manifest's resident cost measured
136.7 to 171.1 B per entry across corpus sizes and page sizes, which is small but not nothing at half a
million rows. Counting it inside the hot-window budget makes its cost visible and halves what is instantly
searchable, to 20,834 events at 200k on the small tier and 54,445 at 500k on the desktop tier. The manifest
is therefore treated as its own resident tier next to the hot window, with its own documented ceiling
derived from the disk budget, on the reasoning that the manifest cannot exceed the events the disk budget
admits and so bounds itself. Hot, instantly searchable content should not be what pays for the directory.

| Measure                                        | 200k, small tier | 500k, desktop tier |
| ---------------------------------------------- | ---------------- | ------------------ |
| Resident events admitted                       | 49,152           | 131,072            |
| Manifest resident bytes, accounted separately  | 27.7 MiB         | 74.8 MiB           |
| Total resident, measured against an empty page | 68.9 MiB         | 175.2 MiB          |
| Tier's documented worst case                   | 73.5 MiB         | 232.8 MiB          |
| `initEventIndex()`                             | 124.7 ms         | 84.2 ms            |
| Manifest load                                  | 756.1 ms         | 1,723.4 ms         |
| Hydration to the budget                        | 6,269.4 ms       | 19,752.2 ms        |
| Long tasks of 50 ms or more during the load    | none             | none               |

Neither run reached the manifest population its tier's ceiling is computed for, so that row is arithmetic on the
per-entry estimate rather than an observation at that scale.

One consequence was user-visible and is the reason increment E exists. While increment C was the head of
the stack, an event that was on disk but outside the hot window was not searchable, because the query path
only consulted the resident inverted index, so the coverage date read `oldestResidentTs`, what a query could
actually see, rather than `oldestIndexedTs`, what disk still held. That understatement of reach has since
been corrected rather than left standing: increment E reaches those events, and the date reads
`oldestIndexedTs` again.

Review: five rounds, ending in SHIP. Mutation campaigns across those rounds killed **16 of 23, then 17 of
20, then 13 of 14** mutants, each round's survivors individually examined rather than counted.

### D-core. Schema v3, binary AES-GCM chunks

Events are no longer individually addressable on disk. They are packed, newest-write-first, into runs of
roughly `CHUNK_TARGET_BYTES` of plaintext, serialised once, sealed under one AES-GCM ciphertext and stored
as a raw binary value rather than base64 inside JSON. The manifest from increment C becomes the chunk
directory: each entry carries the id of the chunk holding it, so hydration, redaction and eviction find the
right chunk in O(1) instead of scanning. This is what takes `eventId` out of the cleartext key set and
closes the leak section 2 used to have to admit. Migration from v2 is the reset described in section 2.

Two things had to be fixed before the layout paid off, and both are instructive.

The first is the test that guards the layout. The "no plaintext in IndexedDB" check ran `JSON.stringify`
over stored values, and `JSON.stringify` of an `ArrayBuffer` is `{}`, so the moment values became binary the
guard passed vacuously and would have kept passing over a database full of cleartext. It was rewritten to
decode `ArrayBuffer`s and every view over one as both Latin-1 and UTF-8 and to recurse through arrays and
objects, and it carries a test of the test: a planted marker must be found inside a chunk blob, a manifest
page blob and a `meta` value alike. Reverting the guard to `JSON.stringify` is a mutant, and it dies.

The second is that the first chunked hydration was slower than the unchunked one it replaced, by 2.2 to 2.6
times per admitted event. Manifest order is recency and chunk packing is arrival order, so a chunk's
members are spread across many hydration pages, and the decrypted-chunk cache was created inside the page
loop. At 200k on the desktop tier that meant 39,475 read transactions against roughly 2,960 chunks that
exist, a re-read factor of 13.3, with 3.3 of about 47 parsed events admitted per read. The count of chunk
reads exceeding the number of chunks by an order of magnitude is what settles it as a cache defect rather
than corpus locality. The fix inverts the loop: walk chunks in `maxTs` order and admit each chunk's
manifest-listed members in one visit, so a chunk is read, decrypted and parsed exactly once per restore.

| Measure                     | 200k, small tier | 200k, desktop tier | 500k, desktop tier   |
| --------------------------- | ---------------- | ------------------ | -------------------- |
| Resident events admitted    | 49,152           | 131,072            | 131,072              |
| Restore                     | 1,834.6 ms       | 3,988.4 ms         | 4,980.6 / 4,990.2 ms |
| Per admitted event          | 37.3 µs          | 30.4 µs            | 38.0 / 38.1 µs       |
| Chunk decrypts              | 922              | 2,140              | 2,441                |
| `chunks` read transactions  | 12               | 31                 | 31                   |
| Long tasks of 50 ms or more | none             | none               | none                 |

The two desktop columns were measured on a harness that does not sample heap during the restore it is
timing; the small-tier column comes from the older harness that does, and the two are not directly
comparable for that reason. The 500k figure is two runs that agree within 0.2%. Peak heap during restore
never exceeded settled heap by more than 3.3%, against the 15% that B17's experiment asked for, which
settles the paged-read half of that assumption.

The storage layout also does what it was meant to do for disk. Measured as directory size against the
manager's own ciphertext accounting, the overhead multiplier falls from 3.65x to 2.45x at the small tier,
466.68 MiB down to 313.32 MiB, and from 3.21x to 2.28x at the desktop tier, 1,116.24 MiB down to
800.47 MiB. The base64 wrapper and the twice-stored record key are gone; what remains is IndexedDB's own
per-record overhead and the fact that ciphertext does not compress.

`CHUNK_TARGET_BYTES` was swept twice, once in isolated crypto and once through the real manager end to end,
and the honest conclusion is weaker than "48 KiB is optimal". Through the real manager at 100k, write cost
rises monotonically with the target and read cost falls monotonically, on-disk size is flat across the whole
range to within 0.13%, and restore time is not monotone and spans only 13% across 16 to 96 KiB, because once
each chunk is read exactly once restore is dominated by per-event resident insertion rather than by chunk
size. What the sweep does settle is that 16 KiB is wrong in both directions, worst on restore and worst on
decrypt with no gain on write. Any value between 32 and 64 KiB is within noise, and 48 KiB is kept because
it is the value already measured, deployed and gated on, and because a sealed chunk is the target plus one
entry, which keeps a 64 KiB target above Chromium's externalisation threshold and a 48 KiB target clear of
it.

Review: four rounds, ending in SHIP. One episode from those rounds is worth keeping, as a caution about
measurement rather than about code. A batched per-room room-order merge was added to speed up hydration,
found to be able to leave a phantom id in `roomOrder` that made Search throw for that room for the rest of
the session, and removed outright rather than patched, since there is then no pending window left to race.
The measurement taken immediately after removal appeared to show a large regression at 500k, and it was
written up as one. It does not reproduce: it was an artefact of the measuring harness, whose heap probe
blocks on a full garbage collection several times during the restore it is timing. On a probe-free harness
the merge-free code restores 500k in 4,980.6 ms, within 9% of the with-merge number, so there is nothing to
recover and the follow-up that was scheduled to recover it has been closed. Mutation testing across the
final round took **twelve surviving mutants down to seven**, of which five are argued equivalent in effect
and two are genuine, recorded coverage gaps in disk-budget heap re-validation and in one of two chunk
bookkeeping paths.

### The conversion that was built and abandoned

Increment D originally carried an online v2 to v3 conversion, so that existing users would keep their
indexed history across the schema change rather than re-crawling it. It was implemented, measured, reviewed
and dropped after three rounds. The review found that it deleted every legacy row it decided not to convert,
so a manifest that was wrong anywhere destroyed those events instead of re-packing them; that a resumed
conversion assigned the disk total from a map covering only the current session, understating it by 95%; that
a redaction landing during an unfinished conversion was silently dropped and the event brought back by the
resume; that it was quadratic for the population that actually exists, which is a v2 database that already
carries increment C's manifest; that it still produced tasks of up to 246 ms; and that the threat model's
cleartext key set was false for every upgrading user for as long as the conversion took. Three rounds did
not converge on any of that.

The decision is to reset instead, which is what the schema v1 to v2 change already did and what three of the
surveyed products do as standard practice (converged practice 12). The cost is a re-crawl, and it is bounded
rather than open-ended precisely because increment C landed first: a reset re-crawls the last
`CRAWL_WINDOW_DAYS` in at most `CRAWL_ROOM_CAP` rooms, not the account's whole history. The conversion code
remains on its own branch for reference and is not part of what ships.

### E. Cold tier: a search session over the chunks on disk

A query answers from the hot window first and, if the page still has room, continues onto disk. The cold
scan walks the sealed chunks newest-first and decrypts **one chunk at a time**, releasing it before reading
the next, so the ciphertext a scan holds is bounded by one chunk rather than by the size of the corpus. Hot
hits are delivered before cold ones and cold ones arrive newest-first, the same recency order hydration and
the crawler already use. A new query on the same index cancels the older one's still-running scan.

The resume state is not a cursor. `next_batch` is an opaque, monotonically increasing token naming an
in-memory **session**, and the session holds the whole answer's state: the resident hit list, the
newest-first chunk walk and the set of every event id already returned, each snapshotted once when the
session is created. A later page is a map lookup of that token, never a recomputation, and the returned-id
set, not a position, is what makes de-duplication exact: a chunk is re-read and re-decrypted on each visit
and its ids filtered through that set, so a partially consumed chunk resumes correctly no matter what became
resident, was redacted or was deleted in between. At most four sessions live at once and a new one evicts
the oldest; an unknown or evicted token returns an empty page with no `next_batch` rather than throwing;
sessions are dropped on teardown, on a reset and on cancellation.

**That shape is the third design, and the first two failed review.** The first was a positional cursor, a
chunk index plus a count of matches, and two independent residency changes break it: a chunk sealing after
page 1 shifts every index by one, so page 2 repeats page 1, and a cold hit that becomes resident shifts the
match counter, so a hit is dropped. The second was a boundary cursor of `(originServerTs, eventId)`, and the
next round broke it in four more ways: a budget-cut page resumed in a chunk that did not contain the
boundary and skipped everything in that chunk newer than it, a resident hit count at an exact multiple of
the page size never reached disk at all, a cut page did not report partiality, and the gone-chunk fallback
anchored on the boundary's timestamp rather than the missing chunk's, skipping live chunks. Every one of
those has the same cause: a position recomputed from mutable live state on every call. Rather than patch a
third cursor, the increment was re-scoped to the session, which removes the class: the walk position becomes
an optimisation instead of a correctness mechanism, provably so, since a mutant that resets it to zero on
every page still returns every hit exactly once. The precedent is Proton's client-held search state, the
largest browser deployment in the survey (section 4).

The re-scope then had to be reviewed on its own terms, and a third round found that it had inverted one
liveness check **in each direction**, both of them user-visible. The cold scan de-duplicated against live
residency instead of against the snapshot, so a matching event that was cold when the session was created
and became resident before the walk reached its chunk was delivered by neither tier and dropped from every
page of that query. In the other direction, the hot loop served snapshotted event objects without
re-checking liveness, so an event redacted between two pages was still served on the later one, with its
cleartext body, even though its on-disk copy had been deleted correctly. The fix is one rule in two places:
ask the session for snapshot questions and the manager for liveness questions. The fourth round is SHIP and
it checked the fixes in both directions rather than only the one the reports named, re-introducing each bug
as its own mutant and confirming that the suite goes red.

**The bound on a page is time, not a page count.** There is no page cap. A page ends when it holds `limit`
results or when `COLD_SCAN_BUDGET_MS` of wall clock is spent, whichever comes first; a page cut short hands
its token back with `isSearchPartial` true, and that flag is false only on the page that exhausts both
tiers. It reaches the user through the warning line that already exists for an index that is still filling,
as one extra disjunct rather than a second warning, because the two say the same thing to a reader: what is
on screen may not be everything. The budget exists because a query that matches nothing cannot stop early:
its only other stopping condition is an exhausted walk, so it decrypts every retained chunk before it can
say so. Unbounded, that miss costs 2,716.9 ms at 200k events and 7,759.2 ms at 500k, roughly 18 to 21 µs per
cold event, sliced so that it never produces a long task but with nothing on screen while it runs. A
one-second budget turns that wait into paged progress the user can see.

**The tier heuristic, E's first item.** An absent `navigator.deviceMemory` no longer means the small tier by
itself. The fallback asks whether the device is plausibly mobile: `navigator.userAgentData.mobile` first, then
a conservative user-agent regex, then iPadOS's default desktop-mode user agent, which since iPadOS 13 carries
neither `iPad` nor `Mobile` and reads as a Mac. That last case is caught by `navigator.maxTouchPoints > 1`
together with a `Macintosh` token, an iPad in desktop mode reporting 5 touch points where a Mac reports 0,
so a genuine Mac is unaffected. Firefox and Safari on the desktop now get the desktop tier; a phone, and an
iPad hiding behind a desktop user agent, keep the small one. The regression is worth naming, because this
increment introduced it: an earlier form of the fix read "no `deviceMemory`" as "desktop" outright, which
put an iPad on a 128 MiB hot window and a 512 MiB disk budget.

**The coverage date now reads the oldest indexed event.** With on-disk content genuinely findable, the
oldest _resident_ timestamp understates reach, so the line reads `oldestIndexedTs`, which is what it always
meant to promise: the date before which a message is not covered at all, because the crawl window or the
disk budget excluded it.

Measured on real Chromium, on the machine of section 5, at two sizes and their own tiers:

| Measure                                   | 200k, small tier | 500k, desktop tier |
| ----------------------------------------- | ---------------- | ------------------ |
| Resident events at session start          | 49,152           | 131,072            |
| Miss query, pages to exhaust the walk     | 4                | 8                  |
| Miss query, total wall time               | 3,058.0 ms       | 7,678.7 ms         |
| Long tasks of 50 ms or more during it     | none             | none               |
| Cancelling a superseded scan              | 13.4 ms          | 42.2 ms            |
| Stale results leaked by a superseded scan | none             | none               |

`isSearchPartial` is true on every page cut short by the budget and false only on the page that exhausts,
at both sizes. The warning's own poll was counted rather than assumed: exactly one `getStats()` call per
second while the component is mounted, none after it unmounts, and the file-panel kind arms no poll at all.
`getStats()` is an in-memory read on this backend, which is why a poll is an acceptable answer to a backend
that fires no event when a search settles.

Review: four rounds, ending in SHIP. The mutation campaign against the session design applied **43 mutants
and killed 23**, and the five properties the design rests on all die under mutation: token generation,
eviction order, the returned-id de-duplication, the budget flag and the four-session bound. The survivors
were argued one at a time rather than counted, and one of them is a real gap that the final round found in
the branch's own claim rather than in its behaviour: the test written to pin "a page never exceeds the
requested `limit`" uses a chunk target so small that the mutant it targets is a no-op, so that guarantee is
pinned only against gross violation. It is a fixture defect, not a behaviour defect, and the one-line fix is
not in the deployed build. Two smaller residuals are recorded rather than fixed: the `count` a session
reports is a lifetime snapshot and can over-report after a redaction until the scan touches disk, and
`loadFileEvents` deliberately has no cold tier at all (section 10).

## 8. Degradation policy

The order below is the order in which pressure arrives, not an order of severity.

| Step                        | Trigger                                                                                                      | What degrades                                                                             | What is kept                                                                                                    | What the user sees                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0. Loading                  | app start until the hot window is hydrated                                                                   | old hits arrive from the cold scan rather than the index, so they are slower and streamed | the app is responsive, the newest chunks are searchable first, identity is exact                                | the existing `SearchWarning` line, with a `loading` disjunct                                                                 |
| 1. Query truncation         | a page holds `limit` results, or `COLD_SCAN_BUDGET_MS` of wall clock is spent                                | this page stops scanning                                                                  | the session, and the opaque token that resumes it                                                               | Element's existing "more results" through `next_batch`, plus the "results may be incomplete" line while a page was cut short |
| 2. Hot-window bound         | resident bytes exceed `HOT_WINDOW_BYTES`                                                                     | the oldest resident events lose postings and payload                                      | they remain reachable through the cold scan, at seconds rather than milliseconds once a query has to sweep disk | results keep arriving; nothing is hidden                                                                                     |
| 3. Crawl window or room cap | age beyond `CRAWL_WINDOW_DAYS`, or a room outside the top `CRAWL_ROOM_CAP`                                   | those messages are never fetched                                                          | everything newer, and every capped room                                                                         | "Search covers messages newer than {date}", plus a per-room "not indexed" note                                               |
| 4. Disk budget              | `ciphertextBytes` over `DISK_BUDGET_BYTES`, or `QuotaExceededError`                                          | the oldest chunks are deleted                                                             | the newest are retained                                                                                         | the date in step 3 moves forward                                                                                             |
| 5. Substring and CJK        | a scan exceeds the slice deadline                                                                            | the scan is spread across slices, never disabled                                          | correctness                                                                                                     | results arrive progressively; labs names CJK as scan-only                                                                    |
| 6. Small tier               | `navigator.deviceMemory` at 4 or below; or, when it is absent, a mobile or iPadOS-in-desktop-mode user agent | smaller constants (section 9)                                                             | the same feature and the same code paths                                                                        | the date in step 3 is nearer                                                                                                 |

**The guarantee.** At every step a query returns every hit in the hot window within the slice budget, then
every hit from everything retained on disk, newest-first, streamed and cancellable, and it states the date
before which nothing is covered. The newest messages are always both resident and covered first, the hot
window is never empty while any data exists, and no step silently changes results. Search degrades in
_latency for old messages_ and in _reach beyond the retained date_, never in correctness within reach. The
earlier wording "findability of old messages degrades" is therefore wrong and is replaced by "old messages
are found more slowly, and the retained date is stated".

**What holds today.** Every step is live, on the deployments named in section 7, and the guarantee above is
met: step 1's bound is a wall-clock budget per page rather than a cap on pages, step 2's cold scan reaches
what the hot window evicted, the coverage date reads the oldest **indexed** event rather than the oldest
resident one, and step 6 no longer sends every Firefox and Safari desktop user down the small tier. Two
residuals are stated rather than papered over. A query whose terms match nothing on disk still has to visit
every retained chunk before it can say so, which is seconds of work at the sizes measured in section 7; what
the budget changes is that the user sees pages and a partiality line throughout rather than one long
spinner. And the file panel has no cold tier at all, so an attachment list is still bounded by the hot
window in the way search no longer is (section 10).

## 9. Constants

These are the values the code ships, read from
[`eventIndexBounds.ts`](https://github.com/element-hq/element-web/blob/develop/apps/web/src/vector/platform/eventIndexBounds.ts)
and from `BrowserEventIndexManager.ts`. They remain provisional: they are derived from the corpus framework
of section 5 rather than from a real account, deliberately, because the one account available to calibrate
against is far too small to derive a bound from, and a bound derived from a sample of one would be worse
evidence than a bound derived from calibrated slopes. The validation runs still outstanding in section 10
can move any of them. Every budget is a count of bytes or of days, never a count of events; the event
counts below are for intuition and are not what the code checks.

| Constant                                                 | Desktop tier                         | Small tier                          | Basis                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hotWindowBytes`                                         | 128 MiB, about 131,072 events        | 48 MiB, about 49,152 events         | roughly 3% and 5% of the old-generation ceiling (B1, B13). Gates hydrated events alone; the manifest is budgeted next to it, not inside it                                                                           |
| `diskBudgetBytes`                                        | 512 MiB, about 700k events           | 128 MiB, about 170k events          | the manager's own exact ciphertext accounting; a steady-state on-disk multiplier is still outstanding, so this is not sized from measured disk                                                                       |
| `manifestCeilingBytes`                                   | about 104.8 MiB, 700,000 times 157 B | about 25.5 MiB, 170,000 times 157 B | the events the disk budget admits times the measured per-entry cost. A documented worst case, self-enforcing through `diskBudgetBytes` (one entry per disk row), not a second runtime check                          |
| `crawlWindowDays` / `crawlRoomCap`                       | 90 / 100                             | 90 / 20                             | [element-meta#3252](https://github.com/element-hq/element-meta/issues/3252); Keybase's 100 desktop and 10 mobile                                                                                                     |
| `CHUNK_TARGET_BYTES`                                     | 48 KiB                               | same                                | B10, and the sweep below                                                                                                                                                                                             |
| `MANIFEST_PAGE_SIZE`                                     | 1,000 entries                        | same                                | the still-filling tail page is re-encrypted on every flush that touches it: 15.8 ms at 10,000 entries against 1.72 ms at 1,000. Sealed pages are rewritten only on a removal, so this is free to tune                |
| `HYDRATION_SLICE_DEADLINE_MS`                            | 30                                   | same                                | the 50 ms long-task threshold with margin (B6); boxed by deadline rather than by count because per-event cost varies about 2x with message shape                                                                     |
| `HYDRATION_CHUNK_BATCH`                                  | 64 chunks per page                   | same                                | each page is released before the next is read (B17)                                                                                                                                                                  |
| `COLD_SCAN_BUDGET_MS`                                    | 1,000 ms per page                    | same                                | the same miss query, unbounded, measured 2,716.9 ms at 200k and 7,759.2 ms at 500k. One second sits under both and turns the wait into paged progress; a 4x-throttled machine argues for less, not more (section 10) |
| `MAX_COLD_SCAN_SESSIONS`                                 | 4 live sessions                      | same                                | bounds the memory a client can pin by issuing queries. A new session evicts the oldest, and a token for an evicted one is an empty page, never a throw                                                               |
| `RESIDENT_BYTES_PER_EVENT_ESTIMATE`                      | 1,024 B                              | same                                | rounds the measured 869 to 914 B per event (B13) up for headroom. Flat per event rather than weighted by text length, because the measured cost is close to a per-event constant                                     |
| `MANIFEST_BYTES_PER_ENTRY_ESTIMATE`                      | 160 B                                | same                                | rounds the measured 136.7 to 171.1 B per entry up, same convention                                                                                                                                                   |
| `LIVE_WRITE_FLUSH_INTERVAL_MS` / `LIVE_WRITE_BUFFER_MAX` | 5,000 ms / 300 events                | same                                | Seshat's `COMMIT_TIME`, converged practice 5; 300 sits inside the measured 200 to 500 records per transaction band                                                                                                   |
| `VOCABULARY_MERGE_THRESHOLD`                             | 2,000 terms                          | same                                | at the corpus's own growth rate this merges roughly once per 13,000 indexed events, and the merge is 17.28 ms at V of 200,000                                                                                        |

`CHUNK_TARGET_BYTES` deserves its caveat spelled out, because the evidence is weaker than a single number
suggests. Swept through the real manager at 100k, write cost rises monotonically with the target and read
cost falls monotonically, on-disk size is flat to within 0.13% across 16 to 96 KiB, and restore time is not
monotone and varies by only 13%. Any value between 32 and 64 KiB is within noise on restore. What the sweep
settles is the lower end: 16 KiB is worst on restore and worst on decrypt with no gain on write. 48 KiB is
kept because a sealed chunk is the target plus one entry, which keeps it clear of Chromium's
externalisation threshold where a 64 KiB target would not be, and because it is the value already measured
and gated on.

There is no `SEARCH_PAGE_CAP`. Converged practice 1 asks for a query-time cap and a resume cursor, and what
shipped keeps the resume half and replaces the cap: a page is bounded by the caller's own `limit` and by
`COLD_SCAN_BUDGET_MS`, and the resume state is a session behind an opaque token rather than a cursor
(section 7, increment E). The fixed two-page cap the design called for was deleted along with the cursor,
because with a per-page time bound and an explicit token the caller decides how far to page, and stopping at
a page count would have withheld hits the user had asked for while there was still budget to find them.

Which tier a browser gets is a decision rather than a constant, and it is worth stating next to the table it
selects: `navigator.deviceMemory` of 4 or below is the small tier and above 4 the desktop tier; when the
property is absent, which is every non-Chromium engine, the choice falls to a mobile and iPadOS user-agent
check, and desktop otherwise.

## 10. Roadmap

Increments A, B, C, D-core and E are built and deployed; section 7 records what each does, what it measures
and what its review found. One increment remains, and it is conditional, plus two follow-ups. Every one of
them keeps the invariants: the cleartext key set is pinned by a test that itself has a test, redaction
removes content from memory and from disk, the
labs gate holds, teardown is reachable after `localStorage.clear()`, and there is no non-IndexedDB `await`
inside a live transaction, which the paged and sliced reads make the single most likely regression.

| Increment           | State       | What it changes                                                                                                                                                                                                                    | What it proves                                                                                                           |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| F. Postings on disk | conditional | the Keybase and Tuta shape, `HMAC(term‖room‖user)` to AES-GCM postings behind an LRU, only if E's hot window proves too small on the small tier; a Worker-resident index only if slicing fails; CJK bigrams as their own change    | CJK query latency on a CJK corpus                                                                                        |
| File panel          | follow-up   | either the cold scan is extended to `loadFileEvents`, or the `Files` warning kind gets the coverage-date line search already has                                                                                                   | an attachment list stops being silently bounded by the hot window                                                        |
| Compact manifest    | follow-up   | fixed-width event ids concatenated into one byte buffer plus typed arrays for the timestamp and room columns, binary-searched rather than held in a `Map` of boxed objects, targeting under 60 B per entry against the current 160 | a tier admits a proportionally larger manifest for the same memory, and the typed arrays sit outside the 4 GiB cage (B4) |

The compact manifest is a follow-up rather than an increment because it may be moot. It was queued when the
manifest was the only recency layer; now that chunks carry their own members, some of what it holds is
duplicated, and now that E has shipped the question it waits on is measurable: how much of the manifest the
cold scan actually needs resident.

**The file panel is not covered by any of this yet, and should be.** `loadFileEvents` answers from
`roomOrder`, that is from the resident set alone, so a room's attachment list is bounded by the hot window
in exactly the way search used to be, and for the same reason. Increment E deliberately did not extend the
cold tier to it, which is now the larger gap of the two: increment A gave the panel the loading warning, so
it is honest while hydration runs, but nothing tells a user that the list is short because the events are
outside the window rather than because the room has no more attachments.

Validation runs still outstanding, with the ones that have since run removed: attribute the 43 µs rebuild
before anyone optimises it; re-run the cold-scan budget under a 4x CPU throttle, where a one-second page
becomes roughly four and the finding would argue for a smaller budget rather than a larger one; re-run the
cold tier and the tier heuristic on Firefox and WebKit, neither of which has seen the session design; fit
vocabulary growth on real multilingual
text rather than a generator (B15); measure a real mid-range laptop and a real phone rather than a CPU
throttle (B19); re-measure disk after an idle period and again on Chrome 150, which replaces LevelDB with
SQLite; measure Element's own baseline heap (B18); and keep running the suite against planted defects,
which is the practice that has caught the most in this work so far.

## 11. Reproducing the measurements

The harness lives on its own branch, because it is developer tooling rather than application code:
[`apps/web/perf/event-index`](https://github.com/inblockio/element-web/tree/perf/web-event-index-harness/apps/web/perf/event-index).
Its README carries the full metric-by-metric description, the corpus parameters and the same results table
as section 5.

```sh
# in a checkout of that branch, after pnpm install and `pnpm exec playwright install chromium`
cd apps/web/perf/event-index

# bundle the unmodified manager plus the corpus generator into a page
node browser/build.mjs

# the numbers in section 5: four sizes, sequentially, each in its own fresh profile
node run-browser.mjs --sizes 20000,50000,100000,200000 --queries 20

# the vocabulary growth curve behind the limitation named in section 5, both generators
node vocab-growth.mjs --checkpoints 30
node vocab-growth.mjs --checkpoints 30 --mode sustained

# the section 7 numbers: non-blocking load, one tier at a time, one profile tag per run
node run-browser.mjs --sizes 200000 --nonblocking --force-tier small
node run-browser.mjs --sizes 500000 --nonblocking --force-tier desktop

# the cross-engine and throttled runs; --throttle is Chromium-only and is refused elsewhere
node run-browser.mjs --sizes 200000 --engine firefox
node run-browser.mjs --sizes 200000 --engine webkit
node run-browser.mjs --sizes 200000 --throttle 4

# the manifest flush cost at a given page size
node run-browser.mjs --flush-cost 1000

# the Node plus fake-indexeddb harness: fast, a floor, never quote it as a browser number
node event-index-perf.mjs --events 20000 --rooms 40 --queries 20 --generator new --json
```

Profiles, build output and result JSON are written under `~/.cache/element-web-event-index-perf`, outside the
repository. Set `EVENT_INDEX_PERF_OUT` to move them. A 200k run writes about 500 MB of profile and takes a
few minutes of continuous writing, so run the large sizes when the machine is otherwise quiet.

Two warnings about the harness itself, both learned the hard way. **Do not compare absolute times across
harness generations.** The generation used for the increment C and D runs samples
`measureUserAgentSpecificMemory()` on a timer during the restore it is timing, and that call blocks on a
full garbage collection, which inflated one 500k result enough to be written up as a regression that does
not exist. Heap ratios within a single run are unaffected; wall-clock totals across runs of different
harnesses are not comparable. And **an empty long-task list outside Chromium proves nothing**, because
neither Firefox nor WebKit throws on `observe({type: "longtask"})` and neither ever emits an entry; use the
timer watchdog's upper bound there and say which of the two a figure came from.
