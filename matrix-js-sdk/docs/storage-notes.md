# Browser Storage Notes

## Overview

Browsers examined: Firefox 67, Chrome 75

The examination below applies to the default, non-persistent storage policy.

## Quota Measurement

Browsers appear to enforce and measure the quota in terms of space on disk, not
data stored, so you may be able to store more data than the simple sum of all
input data depending on how compressible your data is.

## Quota Limit

Specs and documentation suggest we should consistently receive
`QuotaExceededError` when we're near space limits, but the reality is a bit
blurrier.

When we are low on disk space overall or near the group limit / origin quota:

* Chrome
    * Log database may fail to start with AbortError
    * IndexedDB fails to start for crypto: AbortError in connect from
      indexeddb-store-worker
    * When near the quota, QuotaExceededError is used more consistently
* Firefox
    * The first error will be QuotaExceededError
    * Future write attempts will fail with various errors when space is low,
      including nonsense like "InvalidStateError: A mutation operation was
      attempted on a database that did not allow mutations."
    * Once you start getting errors, the DB is effectively wedged in read-only
      mode
    * Can revive access if you reopen the DB

## Cache Eviction

While the Storage Standard says all storage for an origin group should be
limited by a single quota, in practice, browsers appear to handle `localStorage`
separately from the others, so it has a separate quota limit and isn't evicted
when low on space.

* Chrome, Firefox
    * IndexedDB for origin deleted
    * Local Storage remains in place

## Persistent Storage

Storage Standard offers a `navigator.storage.persist` API that can be used to
request persistent storage that won't be deleted by the browser because of low
space.

* Chrome
    * Chrome 75 seems to grant this without any prompt based on [interaction
      criteria](https://developers.google.com/web/updates/2016/06/persistent-storage)
* Firefox
    * Firefox 67 shows a prompt to grant
    * Reverting persistent seems to require revoking permission _and_ clearing
      site data

## Storage Estimation

Storage Standard offers a `navigator.storage.estimate` API to get some clue of
how much space remains.

* Chrome, Firefox
    * Can run this at any time to request an estimate of space remaining
* Firefox
    * Returns `0` for `usage` if a site is persisted
