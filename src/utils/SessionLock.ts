/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { v4 as uuidv4 } from "uuid";

/*
 * Functionality for checking that only one instance is running at once
 *
 * The algorithm here is twofold.
 *
 * First, we "claim" a lock by periodically writing to `STORAGE_ITEM_PING`. On shutdown, we clear that item. So,
 * a new instance starting up can check if the lock is free by inspecting `STORAGE_ITEM_PING`. If it is unset,
 * or is stale, the new instance can assume the lock is free and claim it for itself. Otherwise, the new instance
 * has to wait for the ping to be stale, or the item to be cleared.
 *
 * Secondly, we need a mechanism for proactively telling existing instances to shut down. We do this by writing a
 * unique value to `STORAGE_ITEM_CLAIMANT`. Other instances of the app are supposed to monitor for writes to
 * `STORAGE_ITEM_CLAIMANT` and initiate shutdown when it happens.
 *
 * There is slight complexity in `STORAGE_ITEM_CLAIMANT` in that we need to watch out for yet another instance
 * starting up and staking a claim before we even get a chance to take the lock. When that happens we just bail out
 * and let the newer instance get the lock.
 *
 * `STORAGE_ITEM_OWNER` has no functional role in the lock mechanism; it exists solely as a diagnostic indicator
 * of which instance is writing to `STORAGE_ITEM_PING`.
 */

export const SESSION_LOCK_CONSTANTS = {
    /**
     * LocalStorage key for an item which indicates we have the lock.
     *
     * The instance which holds the lock writes the current time to this key every few seconds, to indicate it is still
     * alive and holds the lock.
     */
    STORAGE_ITEM_PING: "react_sdk_session_lock_ping",

    /**
     * LocalStorage key for an item which holds the unique "session ID" of the instance which currently holds the lock.
     *
     * This property doesn't actually form a functional part of the locking algorithm; it is purely diagnostic.
     */
    STORAGE_ITEM_OWNER: "react_sdk_session_lock_owner",

    /**
     * LocalStorage key for the session ID of the most recent claimant to the lock.
     *
     * Each instance writes to this key on startup, so existing instances can detect new ones starting up.
     */
    STORAGE_ITEM_CLAIMANT: "react_sdk_session_lock_claimant",

    /**
     * The number of milliseconds after which we consider a lock claim stale
     */
    LOCK_EXPIRY_TIME_MS: 30000,
};

/**
 * See if any instances are currently running
 *
 * @returns true if any instance is currently active
 */
export function checkSessionLockFree(): boolean {
    const lastPingTime = window.localStorage.getItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_PING);
    if (lastPingTime === null) {
        // no other holder
        return true;
    }

    // see if it has expired
    const timeAgo = Date.now() - parseInt(lastPingTime);
    return timeAgo > SESSION_LOCK_CONSTANTS.LOCK_EXPIRY_TIME_MS;
}

/**
 * Ensure that only one instance of the application is running at once.
 *
 * If there are any other running instances, tells them to stop, and waits for them to do so.
 *
 * Once we are the sole instance, sets a background job going to service a lock. Then, if another instance starts up,
 * `onNewInstance` is called: it should shut the app down to make sure we aren't doing any more work.
 *
 * @param onNewInstance - callback to handle another instance starting up. NOTE: this may be called before
 *     `getSessionLock` returns if the lock is stolen before we get a chance to start.
 *
 * @returns true if we successfully claimed the lock; false if another instance stole it from under our nose
 *     (in which `onNewInstance` will have been called)
 */
export async function getSessionLock(onNewInstance: () => Promise<void>): Promise<boolean> {
    /** unique ID for this session */
    const sessionIdentifier = uuidv4();

    const prefixedLogger = logger.withPrefix(`getSessionLock[${sessionIdentifier}]`);

    /** The ID of our regular task to service the lock.
     *
     * Non-null while we hold the lock; null if we have not yet claimed it, or have released it. */
    let lockServicer: number | null = null;

    /**
     * See if the lock is free.
     *
     * @returns
     *  - `>0`: the number of milliseconds before the current claim on the lock can be considered stale.
     *  - `0`: the lock is free for the taking
     *  - `<0`: someone else has staked a claim for the lock, so we are no longer in line for it.
     */
    function checkLock(): number {
        // first of all, check that we are still the active claimant (ie, another instance hasn't come along while we were waiting.
        const claimant = window.localStorage.getItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_CLAIMANT);
        if (claimant !== sessionIdentifier) {
            prefixedLogger.warn(`Lock was claimed by ${claimant} while we were waiting for it: aborting startup`);
            return -1;
        }

        const lastPingTime = window.localStorage.getItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_PING);
        const lockHolder = window.localStorage.getItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_OWNER);
        if (lastPingTime === null) {
            prefixedLogger.info("No other session has the lock: proceeding with startup");
            return 0;
        }

        const timeAgo = Date.now() - parseInt(lastPingTime);
        const remaining = SESSION_LOCK_CONSTANTS.LOCK_EXPIRY_TIME_MS - timeAgo;
        if (remaining <= 0) {
            // another session claimed the lock, but it is stale.
            prefixedLogger.info(`Last ping (from ${lockHolder}) was ${timeAgo}ms ago: proceeding with startup`);
            return 0;
        }

        prefixedLogger.info(`Last ping (from ${lockHolder}) was ${timeAgo}ms ago, waiting`);
        return remaining;
    }

    function serviceLock(): void {
        window.localStorage.setItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_OWNER, sessionIdentifier);
        window.localStorage.setItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_PING, Date.now().toString());
    }

    // handler for storage events, used later
    function onStorageEvent(event: StorageEvent): void {
        if (event.key === SESSION_LOCK_CONSTANTS.STORAGE_ITEM_CLAIMANT) {
            // It's possible that the event was delayed, and this update actually predates our claim on the lock.
            // (In particular: suppose tab A and tab B start concurrently and both attempt to set STORAGE_ITEM_CLAIMANT.
            // Each write queues up a `storage` event for all other tabs. So both tabs see the `storage` event from the
            // other, even though by the time it arrives we may have overwritten it.)
            //
            // To resolve any doubt, we check the *actual* state of the storage.
            const claimingSession = window.localStorage.getItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_CLAIMANT);
            if (claimingSession === sessionIdentifier) {
                return;
            }
            prefixedLogger.info(`Session ${claimingSession} is waiting for the lock`);
            window.removeEventListener("storage", onStorageEvent);
            releaseLock().catch((err) => {
                prefixedLogger.error("Error releasing session lock", err);
            });
        }
    }

    async function releaseLock(): Promise<void> {
        // tell the app to shut down
        await onNewInstance();

        // and, once it has done so, stop pinging the lock.
        if (lockServicer !== null) {
            window.clearInterval(lockServicer);
        }
        window.localStorage.removeItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_PING);
        window.localStorage.removeItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_OWNER);
        lockServicer = null;
    }

    // first of all, stake a claim for the lock. This tells anyone else holding the lock that we want it.
    window.localStorage.setItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_CLAIMANT, sessionIdentifier);

    // now, wait for the lock to be free.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const remaining = checkLock();

        if (remaining == 0) {
            // ok, the lock is free, and nobody else has staked a more recent claim.
            break;
        } else if (remaining < 0) {
            // someone else staked a claim for the lock; we bail out.
            await onNewInstance();
            return false;
        }

        // someone else has the lock.
        // wait for either the ping to expire, or a storage event.
        let onStorageUpdate: (event: StorageEvent) => void;

        const storageUpdatePromise = new Promise((resolve) => {
            onStorageUpdate = (event: StorageEvent) => {
                if (
                    event.key === SESSION_LOCK_CONSTANTS.STORAGE_ITEM_PING ||
                    event.key === SESSION_LOCK_CONSTANTS.STORAGE_ITEM_CLAIMANT
                )
                    resolve(event);
            };
        });

        const sleepPromise = new Promise((resolve) => {
            setTimeout(resolve, remaining, undefined);
        });

        window.addEventListener("storage", onStorageUpdate!);
        await Promise.race([sleepPromise, storageUpdatePromise]);
        window.removeEventListener("storage", onStorageUpdate!);
    }

    // If we get here, we know the lock is ours for the taking.

    // CRITICAL SECTION
    //
    // The following code, up to the end of the function, must all be synchronous (ie, no `await` calls), to ensure that
    // we get our listeners in place and all the writes to localStorage done before other tabs run again.

    // claim the lock, and kick off a background process to service it every 5 seconds
    serviceLock();
    lockServicer = window.setInterval(serviceLock, 5000);

    // Now add a listener for other claimants to the lock.
    window.addEventListener("storage", onStorageEvent);

    // also add a listener to clear our claims when our tab closes or navigates away
    window.addEventListener("pagehide", (event) => {
        // only remove the ping if we still think we're the owner. Otherwise we could be removing someone else's claim!
        if (lockServicer !== null) {
            prefixedLogger.debug("page hide: clearing our claim");
            window.localStorage.removeItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_PING);
            window.localStorage.removeItem(SESSION_LOCK_CONSTANTS.STORAGE_ITEM_OWNER);
        }

        // It's worth noting that, according to the spec, the page might come back to life again after a pagehide.
        //
        // In practice that's unlikely because Element is unlikely to qualify for the bfcache, but if it does,
        // this is probably the best we can do: we certainly don't want to stop the user loading any new tabs because
        // Element happens to be in a bfcache somewhere.
        //
        // So, we just hope that we aren't in the middle of any crypto operations, and rely on `onStorageEvent` kicking
        // in soon enough after we resume to tell us if another tab woke up while we were asleep.
    });

    return true;
}
