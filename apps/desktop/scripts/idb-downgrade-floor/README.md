# IndexedDB downgrade-floor check

This folder implements a CI test which fails when bumping Electron would make it impossible for users to roll back
to an earlier Element Desktop release without losing the contents of IndexedDB.

## Chromium downgrade compatibility

Chromium is empirically good (at the time of writing) at allowing upgrades from arbitrary old versions of Chromium
to a more recent version.

However, it occasionally makes breaking changes that prevent downgrades. After an incompatible downgrade the
IndexedDB contents would appear to be empty.

The version compatibility known so far is as follows:

> [!IMPORTANT]
> The table below is not a statement about compatibility of general Element Web/Desktop downgrade compatibility.
> There are multiple reasons why a downgrade may not be possible and this is just one part of it.

| Element Desktop versions | Lowest version that can be downgraded to |
| ------------------------ | ---------------------------------------- |
| 1.11.24 - 1.12.23        | 1.11.24 released 2023-02-28              |
| 1.12.24 - latest         | 1.12.24 released 2026-07-21              |

n.b. it is a complete coincidence that the above patch versions are aligned

## In detail

Element Desktop serves the app from the `vector://vector` origin, and Chromium keys its IndexedDB
backing store per origin rather than per database. So one LevelDB store under `<profile>/IndexedDB`
holds _every_ Element database at once: the sync store, the legacy crypto store, and
`matrix-js-sdk::matrix-sdk-crypto` etc.

That store records two numbers in its global metadata:

- **`SchemaVersion`** — `kLatestKnownSchemaVersion`, from
  `content/browser/indexed_db/indexed_db_leveldb_coding.h`
- **`DataVersion`** — `(v8::CurrentValueSerializerFormatVersion() << 32) | blink::kSerializedScriptValueVersion`

On open, Chromium accepts the store only if the running build is at least as new as what is on disk.
Otherwise it returns `Status::Corruption("Unknown IndexedDB schema")` and destroys the store
wholesale. Upgrades migrate in place; **downgrades across an increase in any of those three numbers
lose everything for the origin**, which for an Element Desktop user means being logged out with no crypto store,
recoverable only from key backup.

### Where that comes from

The links below are pinned to Chromium `152.0.7977.76` as line numbers move between versions:

1. **Both numbers are checked on open.** [`AreSchemasKnown()`][areschemasknown] rejects the store if
   the schema version falls outside `[kEarliestSupportedSchemaVersion, kLatestKnownSchemaVersion]`
   ([L261-263][schemarange]), or if the current build is not at least as new as the stored data
   version ([L280][dataversioncheck]).
2. **Any one of the three numbers is enough.** [`IsAtLeast()`][isatleast] compares componentwise:
   `v8_version_ >= other.v8_version_ && blink_version_ >= other.blink_version_`. So a single newer
   component on disk fails the whole check. The data version packs both
   ([`Encode()`][encode]: `(v8_version_ << 32) | blink_version_`) from
   [`v8::CurrentValueSerializerFormatVersion()` and `blink::kSerializedScriptValueVersion`][current].
3. **Failing that check is treated as corruption.** The rejection becomes
   [`Status::Corruption("Unknown IndexedDB schema")`][corruption].
4. **Corruption destroys the store.** [`HandleCorruption()`][handlecorruption] calls
   `DestroyDatabase()` on the whole LevelDB directory, and the corruption marker written alongside it
   makes the next open [delete it again][priorcorruption] before recreating it empty.
5. **The store is per origin, not per database.** What gets destroyed is
   `path_base.Append(GetLevelDBFileName(bucket_locator))` — one directory holding every database for
   the bucket, as [`GetCompleteMetadata()`][completemetadata] enumerating `GetDatabaseNames()` shows.
   That is why losing it takes the sync store and both crypto stores together.

Observed directly when downgrading 1.12.24 to 1.12.23, which logged (at that build's line numbers):

```
ERROR:...backing_store.cc:1600] IndexedDB backing store had unknown schema, treating it as failure to open.
ERROR:...backing_store.cc:1656] Got corruption for { origin: vector://vector, ... }
ERROR:...backing_store.cc:1517] IndexedDB recovering from a corrupted (and deleted) database.
```

[areschemasknown]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L247
[schemarange]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L261-L263
[dataversioncheck]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L280
[isatleast]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/indexed_db_data_format_version.h#L37-L40
[encode]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/indexed_db_data_format_version.h#L52
[current]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/indexed_db_data_format_version.cc#L13-L15
[corruption]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L1581-L1585
[handlecorruption]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L1676-L1688
[priorcorruption]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L1513
[completemetadata]: https://github.com/chromium/chromium/blob/152.0.7977.76/content/browser/indexed_db/instance/leveldb/backing_store.cc#L1654-L1656

All three are compile-time constants with no platform conditionals identically on macOS, Windows and Linux. When one
increases, the release shipping it becomes a _downgrade floor_: the oldest version support can ever ask those users to
go back to.

It is rare but real. It has happened twice:

| Element | Release date | Electron change | Chromium  | What increased           |
| ------- | ------------ | --------------- | --------- | ------------------------ |
| 1.11.24 | 2023-02-28   | 22 → 23         | 108 → 110 | Blink serializer 20 → 21 |
| 1.12.24 | 2026-07-21   | 42 → 43         | 148 → 150 | V8 serializer 15 → 16    |

Both were verified against real packaged builds: an upgrade across either boundary preserves data,
and a downgrade across either destroys it.

## When the check runs

Reading the three constants means fetching from `releases.electronjs.org` and the Chromium and V8
mirrors on GitHub, so the unit test does not do it on every run. Instead it resolves them only when
the **Electron major** differs from the one recorded in `idb-format-baseline.json`.

Electron majors map to Chromium milestones, and all three constants are fixed when Chromium cuts the
release branch — a serialisation format change is not expected to be cherry-picked onto a stable
branch, so an Electron patch bump cannot move them. Both floors in the table above landed on a major
boundary. Keying on the exact version instead would mean the roughly weekly Renovate patch bumps
left the baseline stale, and every unrelated pull request would go back to paying for the network
round trip.

The `idb-downgrade-floor.yml` workflow runs the same check on a schedule regardless of the Electron
version, so if that assumption is ever wrong — or upstream moves one of the headers this parses — it
surfaces there rather than in the middle of an Electron upgrade.

## Accepting a new floor

To accept a new floor, run:

```sh
pnpm idb:baseline
```

And then update the table above with the new data.

The script rewrites the baseline for the current floor and reports what changed. The resulting diff is
the record that somebody decided to accept it, so it should be called out in the release notes: it
sets the oldest version support can ask a user to downgrade to. `pnpm idb:baseline -- --check`
reports without writing and exits non-zero, for use outside the test suite.

Run it on every Electron **major** bump, whether or not it introduces a floor: that refreshes the
recorded `electron` version and re-arms the skip, so later patch bumps stay offline.

`idb-format-baseline.json` also records `currentFloor`, the oldest Element Desktop release the
current format era can be downgraded to. That is the number support actually needs.
