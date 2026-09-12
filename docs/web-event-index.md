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
constants (section 8), and the honest description of what a user gets is "search covers messages newer
than {date}", not "search covers your history".

## 2. Threat model

The data encryption key is derived with HKDF-SHA256 from the session pickle key, whose own ciphertext and
wrapping key live in the same origin's IndexedDB, so an attacker who exfiltrates only the
`element-eventindex` database learns metadata rather than message content, while one who takes the whole
browser profile can re-derive the key and read everything, which is the assumption Element already makes
for access tokens. Against XSS in this origin it buys nothing, because script there can ask the platform
for the pickle key or read the already-decrypted in-memory index. The precise statement of what remains
cleartext on disk, including the consequence that a cleartext `eventId` discloses which rooms are indexed
to anyone who can map event ids back to rooms, is maintained in the `## Threat model` section of the file
header in
[`BrowserEventIndexManager.ts`](https://github.com/element-hq/element-web/blob/develop/apps/web/src/vector/platform/BrowserEventIndexManager.ts);
that header is the normative version and is not duplicated here.

## 3. What bounds a client-side encrypted index in a browser

Each claim carries one label. **Hard** is fixed by a specification or an engine constant. **Measured** was
run, on the engine and machine named in section 5. **Assumption** is believed and not yet established
here, and names the experiment that would settle it.

| #   | Claim                                                                                                                                                                                                                                                      | Label                                                                                                                                                        | Source                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | The V8 pointer-compression cage is 4 GiB and caps old space; the default maximum old generation is `clamp(physical_memory / ratio, 256 MB, 4 GB)`, with ratio 2 on 64-bit desktop and 4 on Android                                                         | Hard                                                                                                                                                         | [`v8-internal.h`](https://github.com/v8/v8/blob/main/include/v8-internal.h), [`heap.cc`](https://github.com/v8/v8/blob/main/src/heap/heap.cc)                                                       |
| B2  | Exceeding the heap is an uncatchable process abort (`FatalProcessOutOfMemory` to `abort()`), not a JS exception, so an eviction policy cannot be reactive and the bound must be a static self-accounting budget in bytes                                   | Hard                                                                                                                                                         | [`heap.cc`](https://github.com/v8/v8/blob/main/src/heap/heap.cc), [v8-users](https://groups.google.com/g/v8-users/c/vKn1hVs8KNQ)                                                                    |
| B3  | A Web Worker does not raise the memory budget: since V8 9.2 all isolates in a process share one 4 GiB cage                                                                                                                                                 | Hard                                                                                                                                                         | [v8.dev/blog/v8-release-92](https://v8.dev/blog/v8-release-92)                                                                                                                                      |
| B4  | `ArrayBuffer` and `TypedArray` backing stores live outside the cage; plain objects, strings, `Map` and `Set` do not                                                                                                                                        | Hard                                                                                                                                                         | [`v8-internal.h`](https://github.com/v8/v8/blob/main/include/v8-internal.h), [V8 sandbox README](https://chromium.googlesource.com/v8/v8.git/+/refs/heads/main/src/sandbox/README.md)               |
| B5  | `await crypto.subtle.decrypt` is not a yield point: AES-GCM, SHA, HMAC, HKDF, ECDH and ECDSA all run synchronously on the calling thread in Chromium, with no size threshold and no thread hop (only RSA key generation and PBKDF2 are posted elsewhere)   | Hard                                                                                                                                                         | [`webcrypto_impl.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/webcrypto/webcrypto_impl.cc)                                                                      |
| B6  | A long task is anything over 50 ms; INP is good at 200 ms or less; chunking guidance is a 50 ms deadline per chunk                                                                                                                                         | Hard                                                                                                                                                         | [Long Tasks](https://w3c.github.io/longtasks/), [CWV thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds), [optimize long tasks](https://web.dev/articles/optimize-long-tasks) |
| B7  | Neither `navigator.storage.estimate()` nor `performance.measureUserAgentSpecificMemory()` can be used for policy in Element: the first is deliberately padded, the second needs cross-origin isolation that Element's CSP forecloses                       | Hard                                                                                                                                                         | [estimating storage](https://developer.chrome.com/blog/estimating-available-storage-space/), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)     |
| B8  | Storage eviction deletes an entire origin at once and skips origins granted persistence; Safari ITP deletes script-writable storage after 7 days without a first-party interaction                                                                         | Hard                                                                                                                                                         | [MDN quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [WebKit tracking prevention](https://webkit.org/tracking-prevention/) |
| B9  | Evicting the origin destroys the session, not just the index: the pickle key and the rust crypto store share it. `navigator.storage.persist()` is therefore required, and the current code does not call it                                                | Hard for the mechanism, inferred for the consequence                                                                                                         | as B8, plus `apps/web/src/utils/tokens/pickling.ts`                                                                                                                                                 |
| B10 | Chrome externalises IndexedDB values above 64 KiB into blob files; Firefox above 1 MiB; AES-GCM amortises its per-call cost by about 16 KiB and is throughput-bound by about 256 KiB. The intersection is a chunk of 32 to 64 KiB, roughly 50 to 90 events | Hard for the thresholds, inferred for the intersection                                                                                                       | Chromium and Gecko constants; AES-GCM measured on Chromium 149                                                                                                                                      |
| B11 | The crawler cannot reach these corpus sizes in one sitting: `EVENTS_PER_CRAWL` is 100 and the default sleep is 3000 ms, so 2,000 events per minute, which is 100 minutes for 200k and 8.3 hours for 1M                                                     | Hard, from the constants in `EventIndex.ts` and `Settings.tsx`                                                                                               | the code                                                                                                                                                                                            |
| B12 | Cold restore is linear in the number of indexed events and about two thirds of it is one uninterruptible main-thread task                                                                                                                                  | Measured                                                                                                                                                     | section 5                                                                                                                                                                                           |
| B13 | Resident heap is 869 to 914 B per indexed event in Chrome for the real record shape                                                                                                                                                                        | Measured (no GC bracket, so about 10% error)                                                                                                                 | section 5                                                                                                                                                                                           |
| B14 | The JS rebuild (base64 decode, `JSON.parse`, `tokenize`, `Map`/`Set` inserts, one sort per room) is the largest restore bucket at every size and no storage layout removes it                                                                              | Measured                                                                                                                                                     | section 5                                                                                                                                                                                           |
| B15 | Real vocabulary follows Heaps' law and never saturates, so the cost of the vocabulary walk in `lookupToken` keeps growing; `tokenize` keeps `\p{N}`, which inflates it further                                                                             | Hard as an empirical law, inferred for this tokeniser                                                                                                        | [Heaps' law](https://nlp.stanford.edu/IR-book/html/htmledition/heaps-law-estimating-the-number-of-terms-1.html)                                                                                     |
| B16 | A CJK message tokenises to exactly one token, because the splitter breaks on anything that is not `\p{L}`, `\p{N}` or `_`, so every mid-sentence CJK query falls to the substring scan                                                                     | Hard, from `tokenize`                                                                                                                                        | the code                                                                                                                                                                                            |
| B17 | An unpaged `getAll` roughly doubles peak memory during restore, because the array of every ciphertext row stays reachable across the whole decrypt loop                                                                                                    | Assumption. Experiment: peak heap during a whole-corpus `getAll` restore versus a paged one at 200k; pass if the paged peak is within 15% of the final index | `loadAllForUser`                                                                                                                                                                                    |
| B18 | Element's own baseline heap without the index is 150 to 400 MB                                                                                                                                                                                             | Assumption. Experiment: load Element with the flag off, sync a real account, idle, GC, read the heap                                                         | none yet                                                                                                                                                                                            |
| B19 | A mid-range laptop is about 2.5x slower than the machine in section 5                                                                                                                                                                                      | Assumption. Experiment: CPU throttling at 4x on the 200k corpus                                                                                              | none yet                                                                                                                                                                                            |

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
| **Element Web #34718 today**             | IndexedDB, one AES-GCM record per event; the inverted index is rebuilt in RAM on every load | per event                                                                                   | **resident and uncapped**                                     | fully awaited before the client starts                                                                         | none: `fullCrawl`, offset paging, no cap                                                         | this repository                                                                                                                                                                                  | verified |

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

- **One fast desktop.** No mid-range laptop, no mobile, no Firefox, no Safari. Absolute times are floors;
  the slopes and the ratios are the transferable part. The 2.5x laptop factor is B19, an assumption.
- **The vocabulary sampler cannot sustain Heaps' law within one run.** The generator picks one target
  vocabulary from Heaps' law for the corpus's final size and then Zipf-samples every message from that fixed
  pool. The final vocabulary lands within 2 to 13% of the target at every size, so it is correctly sized
  _across_ runs, but the fitted within-run exponent falls from 0.542 at 20k to 0.398 at 200k as the corpus
  runs out of new words. Real vocabulary never saturates (B15), so the token and prefix query numbers below
  are **underestimates** at scale. The substring and memory numbers do not depend on vocabulary and are
  unaffected.
- **Heap without a GC bracket.** `performance.measureUserAgentSpecificMemory()` does its own accounting and
  no explicit collection was forced. The slope is consistent across four sizes, so about 10% is the
  plausible error.
- **Disk measured immediately after a write burst**, with no idle time for LevelDB compaction, so it is
  "disk right after a crawl" and not a steady state. Chrome 150 replaces LevelDB with SQLite and the
  measurement will have to be repeated there.
- **Nothing sliced, paged, packed or windowed has been measured.** Every figure in section 6 about what the
  new design achieves is arithmetic on the measured slopes below, which is a prediction, not a measurement.

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

**Storage layout.** Two object stores under the same key `[userId, chunkId]`: `chunkmeta` holds an encrypted
header (`minTs`, `maxTs`, `roomId`, `n`, `eventIds`) and `chunks` the encrypted body, both `Uint8Array`, both
AAD-bound to their key. Cleartext residue shrinks to `userId`, `chunkId` and the ciphertext length, which
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
aborting on the next keystroke. The predicted cold-scan cost is about 5 µs per event (1.2 read, 3.5 decrypt,
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

## 7. Degradation policy

The order below is the order in which pressure arrives, not an order of severity.

| Step                        | Trigger                                                                    | What degrades                                                                             | What is kept                                                                             | What the user sees                                                             |
| --------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 0. Loading                  | app start until the hot window is hydrated                                 | old hits arrive from the cold scan rather than the index, so they are slower and streamed | the app is responsive, the newest chunks are searchable first, identity is exact         | the existing `SearchWarning` line, with a `loading` disjunct                   |
| 1. Query truncation         | hits reach two pages                                                       | this query stops scanning                                                                 | a resume cursor                                                                          | Element's existing "more results" through `next_batch`                         |
| 2. Hot-window bound         | resident bytes exceed `HOT_WINDOW_BYTES`                                   | the oldest resident events lose postings and payload                                      | they remain reachable through the cold scan, in milliseconds to hundreds of milliseconds | results keep arriving; nothing is hidden                                       |
| 3. Crawl window or room cap | age beyond `CRAWL_WINDOW_DAYS`, or a room outside the top `CRAWL_ROOM_CAP` | those messages are never fetched                                                          | everything newer, and every capped room                                                  | "Search covers messages newer than {date}", plus a per-room "not indexed" note |
| 4. Disk budget              | `ciphertextBytes` over `DISK_BUDGET_BYTES`, or `QuotaExceededError`        | the oldest chunks are deleted                                                             | the newest are retained                                                                  | the date in step 3 moves forward                                               |
| 5. Substring and CJK        | a scan exceeds the slice deadline                                          | the scan is spread across slices, never disabled                                          | correctness                                                                              | results arrive progressively; labs names CJK as scan-only                      |
| 6. Small tier               | `navigator.deviceMemory` at 4 or below, or absent                          | smaller constants (section 8)                                                             | the same feature and the same code paths                                                 | the date in step 3 is nearer                                                   |

**The guarantee.** At every step a query returns every hit in the hot window within the slice budget, then
every hit from everything retained on disk, newest-first, streamed and cancellable, and it states the date
before which nothing is covered. The newest messages are always both resident and covered first, the hot
window is never empty while any data exists, and no step silently changes results. Search degrades in
_latency for old messages_ and in _reach beyond the retained date_, never in correctness within reach. The
earlier wording "findability of old messages degrades" is therefore wrong and is replaced by "old messages
are found more slowly, and the retained date is stated".

## 8. Constants

All of these are provisional. They are derived from the corpus framework in section 5 rather than from a
real account, and the validation runs listed in section 9 can move any of them.

| Constant                                    | Desktop tier                          | Small tier (`deviceMemory` 4 or less, or absent) | Basis                                                                                                                            |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `HOT_WINDOW_BYTES`                          | 128 MiB (about 140k events at 0.9 KB) | 48 MiB (about 50k)                               | 3% and 5% of the old-generation ceiling (B1, B13); hydration is about 7 s and 2.4 s of CPU in slices on the machine in section 5 |
| `DISK_BUDGET_BYTES` (ciphertext accounting) | 512 MiB (about 700k events)           | 128 MiB (about 170k)                             | the manager's own accounting; pending a steady-state on-disk multiplier                                                          |
| `CRAWL_WINDOW_DAYS` / `CRAWL_ROOM_CAP`      | 90 / 100                              | 90 / 20                                          | [element-meta#3252](https://github.com/element-hq/element-meta/issues/3252); Keybase's 100 desktop and 10 mobile                 |
| `CHUNK_TARGET_BYTES`                        | 48 KiB                                | same                                             | B10: Chrome's 64 KiB externalisation threshold and AES-GCM's amortisation point                                                  |
| `SLICE_DEADLINE_MS`                         | 30                                    | same                                             | the 50 ms long-task threshold with margin (B6)                                                                                   |
| `SEARCH_PAGE_CAP`                           | 2x the requested limit                | same                                             | Proton, and converged practice 1                                                                                                 |
| `PERSIST_FLUSH`                             | per crawl batch, or 5 s               | same                                             | Seshat's `COMMIT_TIME`, and converged practice 5                                                                                 |

## 9. Roadmap

Each increment is a separate change that proves itself with a measurement, and each keeps the invariants: the
cleartext key set is pinned by a test, redaction removes content from memory and from disk, the labs gate
holds, teardown is reachable after `localStorage.clear()`, and there is no non-IndexedDB `await` inside a
live transaction, which the paged and sliced reads make the single most likely regression.

| Increment                               | What it changes                                                                                                                                                                                                                                                                                                                                                                             | Needs shared `EventIndex.ts` or UI changes?                                                       | What it proves                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Non-blocking load                    | `isEventIndexEmpty` through `getKey`; `initEventIndex` returns after meta, keys and the identity set; hydration in 30 ms deadline slices; a `loading` bit in `IIndexStats` and one disjunct in `useIsIndexIncomplete`; search runs against partial residency; field instrumentation                                                                                                         | yes, but small: one optional `IIndexStats` field and a one-line UI disjunct                       | no task over 50 ms at 200k, and time-to-interactive independent of n                                                                                           |
| B. Cheap wins, no schema change         | one write transaction per crawl batch or 5 s flush; `getStats()` room count from `roomOrder`; a position map for `contextFor`; sorted vocabulary with sort-on-demand; derive folded text on demand instead of memoising it                                                                                                                                                                  | no                                                                                                | drain under 0.05 ms per event, prefix query flat in vocabulary size, `getStats` O(1)                                                                           |
| C. Bound the input and the resident set | the `shouldCrawl` hook plus window and room-cap constants and breadth-first weekly order; a minimal byte-budget drop on the current schema; `navigator.storage.persist()`; `windowed` and `oldestIndexedTs` in stats; the "newer than {date}" line                                                                                                                                          | **yes**: about fifteen lines in `EventIndex.ts`, two `IIndexStats` fields, and the search warning | resident bytes never exceed the budget at 500k ingested, and the crawl stops at the window                                                                     |
| D. Schema v3, chunks                    | binary encrypted chunks with an encrypted header and a global `chunkId`; recency-ordered paged hydration; one transaction per chunk; reset migration; rewritten threat-model header. The "no plaintext in IndexedDB" test must be fixed first, with a planted-plaintext test of the test, because `JSON.stringify` of an `ArrayBuffer` is `{}` and the guard would otherwise pass vacuously | no                                                                                                | the restore peak is within 15% of the final index (B17); the chunk optimum has a stated mechanism; write cost per event falls by about two orders of magnitude |
| E. Tiered residency and the cold tier   | the hot-window byte budget per platform tier; identity-only residency beyond it; the streamed cold scan with a page cap and resume cursor; disk budget with oldest-chunk deletion; a text-lane split if the scan turns out to be the bottleneck                                                                                                                                             | no                                                                                                | the cold scan holds near 5 µs per event, and 500k events fit the small-tier profile without exceeding budget                                                   |
| F. Conditional                          | postings on disk (the Keybase and Tuta shape: `HMAC(term‖room‖user)` to AES-GCM postings behind an LRU) only if E's hot window proves too small on the small tier; a Worker-resident index only if slicing fails; CJK bigrams as their own change                                                                                                                                           | no                                                                                                | CJK query latency on a CJK corpus                                                                                                                              |

Validation runs that gate these: attribute the 43 µs rebuild before optimising it; confirm the deadline
slices hold every task under 50 ms for at most 1.3x wall time; confirm a paged read removes the restore peak
(B17); sweep chunk size on Chrome 149 and 150; sweep transaction size on all three engines; measure the cold
scan; fit vocabulary growth on real multilingual text (B15); run Firefox and WebKit; measure the laptop
factor (B19); re-measure disk after an idle period; measure Element's baseline heap (B18); and run the suite
against a planted defect to show it would be caught.

## 10. Reproducing the measurements

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

# the vocabulary growth curve behind the limitation named in section 5
node vocab-growth.mjs --checkpoints 30

# the Node plus fake-indexeddb harness: fast, a floor, never quote it as a browser number
node event-index-perf.mjs --events 20000 --rooms 40 --queries 20 --generator new --json
```

Profiles, build output and result JSON are written under `~/.cache/element-web-event-index-perf`, outside the
repository. Set `EVENT_INDEX_PERF_OUT` to move them. A 200k run writes about 500 MB of profile and takes a
few minutes of continuous writing, so run the large sizes when the machine is otherwise quiet.
