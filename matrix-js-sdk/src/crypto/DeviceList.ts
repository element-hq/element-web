/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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

/**
 * Manages the list of other users' devices
 */

import { logger } from "../logger";
import { DeviceInfo, IDevice } from "./deviceinfo";
import { CrossSigningInfo, ICrossSigningInfo } from "./CrossSigning";
import * as olmlib from "./olmlib";
import { IndexedDBCryptoStore } from "./store/indexeddb-crypto-store";
import { chunkPromises, defer, IDeferred, sleep } from "../utils";
import { DeviceKeys, IDownloadKeyResult, Keys, MatrixClient, SigningKeys } from "../client";
import { OlmDevice } from "./OlmDevice";
import { CryptoStore } from "./store/base";
import { TypedEventEmitter } from "../models/typed-event-emitter";
import { CryptoEvent, CryptoEventHandlerMap } from "./index";

/* State transition diagram for DeviceList.deviceTrackingStatus
 *
 *                                |
 *     stopTrackingDeviceList     V
 *   +---------------------> NOT_TRACKED
 *   |                            |
 *   +<--------------------+      | startTrackingDeviceList
 *   |                     |      V
 *   |   +-------------> PENDING_DOWNLOAD <--------------------+-+
 *   |   |                      ^ |                            | |
 *   |   | restart     download | |  start download            | | invalidateUserDeviceList
 *   |   | client        failed | |                            | |
 *   |   |                      | V                            | |
 *   |   +------------ DOWNLOAD_IN_PROGRESS -------------------+ |
 *   |                    |       |                              |
 *   +<-------------------+       |  download successful         |
 *   ^                            V                              |
 *   +----------------------- UP_TO_DATE ------------------------+
 */

// constants for DeviceList.deviceTrackingStatus
export enum TrackingStatus {
    NotTracked,
    PendingDownload,
    DownloadInProgress,
    UpToDate,
}

// user-Id → device-Id → DeviceInfo
export type DeviceInfoMap = Map<string, Map<string, DeviceInfo>>;

type EmittedEvents = CryptoEvent.WillUpdateDevices | CryptoEvent.DevicesUpdated | CryptoEvent.UserCrossSigningUpdated;

export class DeviceList extends TypedEventEmitter<EmittedEvents, CryptoEventHandlerMap> {
    private devices: { [userId: string]: { [deviceId: string]: IDevice } } = {};

    public crossSigningInfo: { [userId: string]: ICrossSigningInfo } = {};

    // map of identity keys to the user who owns it
    private userByIdentityKey: Record<string, string> = {};

    // which users we are tracking device status for.
    private deviceTrackingStatus: { [userId: string]: TrackingStatus } = {}; // loaded from storage in load()

    // The 'next_batch' sync token at the point the data was written,
    // ie. a token representing the point immediately after the
    // moment represented by the snapshot in the db.
    private syncToken: string | null = null;

    private keyDownloadsInProgressByUser = new Map<string, Promise<void>>();

    // Set whenever changes are made other than setting the sync token
    private dirty = false;

    // Promise resolved when device data is saved
    private savePromise: Promise<boolean> | null = null;
    // Function that resolves the save promise
    private resolveSavePromise: ((saved: boolean) => void) | null = null;
    // The time the save is scheduled for
    private savePromiseTime: number | null = null;
    // The timer used to delay the save
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    // True if we have fetched data from the server or loaded a non-empty
    // set of device data from the store
    private hasFetched: boolean | null = null;

    private readonly serialiser: DeviceListUpdateSerialiser;

    public constructor(
        baseApis: MatrixClient,
        private readonly cryptoStore: CryptoStore,
        olmDevice: OlmDevice,
        // Maximum number of user IDs per request to prevent server overload (#1619)
        public readonly keyDownloadChunkSize = 250,
    ) {
        super();

        this.serialiser = new DeviceListUpdateSerialiser(baseApis, olmDevice, this);
    }

    /**
     * Load the device tracking state from storage
     */
    public async load(): Promise<void> {
        await this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_DEVICE_DATA], (txn) => {
            this.cryptoStore.getEndToEndDeviceData(txn, (deviceData) => {
                this.hasFetched = Boolean(deviceData?.devices);
                this.devices = deviceData ? deviceData.devices : {};
                this.crossSigningInfo = deviceData ? deviceData.crossSigningInfo || {} : {};
                this.deviceTrackingStatus = deviceData ? deviceData.trackingStatus : {};
                this.syncToken = deviceData?.syncToken ?? null;
                this.userByIdentityKey = {};
                for (const user of Object.keys(this.devices)) {
                    const userDevices = this.devices[user];
                    for (const device of Object.keys(userDevices)) {
                        const idKey = userDevices[device].keys["curve25519:" + device];
                        if (idKey !== undefined) {
                            this.userByIdentityKey[idKey] = user;
                        }
                    }
                }
            });
        });

        for (const u of Object.keys(this.deviceTrackingStatus)) {
            // if a download was in progress when we got shut down, it isn't any more.
            if (this.deviceTrackingStatus[u] == TrackingStatus.DownloadInProgress) {
                this.deviceTrackingStatus[u] = TrackingStatus.PendingDownload;
            }
        }
    }

    public stop(): void {
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
        }
    }

    /**
     * Save the device tracking state to storage, if any changes are
     * pending other than updating the sync token
     *
     * The actual save will be delayed by a short amount of time to
     * aggregate multiple writes to the database.
     *
     * @param delay - Time in ms before which the save actually happens.
     *     By default, the save is delayed for a short period in order to batch
     *     multiple writes, but this behaviour can be disabled by passing 0.
     *
     * @returns true if the data was saved, false if
     *     it was not (eg. because no changes were pending). The promise
     *     will only resolve once the data is saved, so may take some time
     *     to resolve.
     */
    public async saveIfDirty(delay = 500): Promise<boolean> {
        if (!this.dirty) return Promise.resolve(false);
        // Delay saves for a bit so we can aggregate multiple saves that happen
        // in quick succession (eg. when a whole room's devices are marked as known)

        const targetTime = Date.now() + delay;
        if (this.savePromiseTime && targetTime < this.savePromiseTime) {
            // There's a save scheduled but for after we would like: cancel
            // it & schedule one for the time we want
            clearTimeout(this.saveTimer!);
            this.saveTimer = null;
            this.savePromiseTime = null;
            // (but keep the save promise since whatever called save before
            // will still want to know when the save is done)
        }

        let savePromise = this.savePromise;
        if (savePromise === null) {
            savePromise = new Promise((resolve) => {
                this.resolveSavePromise = resolve;
            });
            this.savePromise = savePromise;
        }

        if (this.saveTimer === null) {
            const resolveSavePromise = this.resolveSavePromise;
            this.savePromiseTime = targetTime;
            this.saveTimer = setTimeout(() => {
                logger.log("Saving device tracking data", this.syncToken);

                // null out savePromise now (after the delay but before the write),
                // otherwise we could return the existing promise when the save has
                // actually already happened.
                this.savePromiseTime = null;
                this.saveTimer = null;
                this.savePromise = null;
                this.resolveSavePromise = null;

                this.cryptoStore
                    .doTxn("readwrite", [IndexedDBCryptoStore.STORE_DEVICE_DATA], (txn) => {
                        this.cryptoStore.storeEndToEndDeviceData(
                            {
                                devices: this.devices,
                                crossSigningInfo: this.crossSigningInfo,
                                trackingStatus: this.deviceTrackingStatus,
                                syncToken: this.syncToken ?? undefined,
                            },
                            txn,
                        );
                    })
                    .then(
                        () => {
                            // The device list is considered dirty until the write completes.
                            this.dirty = false;
                            resolveSavePromise?.(true);
                        },
                        (err) => {
                            logger.error("Failed to save device tracking data", this.syncToken);
                            logger.error(err);
                        },
                    );
            }, delay);
        }

        return savePromise;
    }

    /**
     * Gets the sync token last set with setSyncToken
     *
     * @returns The sync token
     */
    public getSyncToken(): string | null {
        return this.syncToken;
    }

    /**
     * Sets the sync token that the app will pass as the 'since' to the /sync
     * endpoint next time it syncs.
     * The sync token must always be set after any changes made as a result of
     * data in that sync since setting the sync token to a newer one will mean
     * those changed will not be synced from the server if a new client starts
     * up with that data.
     *
     * @param st - The sync token
     */
    public setSyncToken(st: string | null): void {
        this.syncToken = st;
    }

    /**
     * Ensures up to date keys for a list of users are stored in the session store,
     * downloading and storing them if they're not (or if forceDownload is
     * true).
     * @param userIds - The users to fetch.
     * @param forceDownload - Always download the keys even if cached.
     *
     * @returns A promise which resolves to a map userId-\>deviceId-\>{@link DeviceInfo}.
     */
    public downloadKeys(userIds: string[], forceDownload: boolean): Promise<DeviceInfoMap> {
        const usersToDownload: string[] = [];
        const promises: Promise<unknown>[] = [];

        userIds.forEach((u) => {
            const trackingStatus = this.deviceTrackingStatus[u];
            if (this.keyDownloadsInProgressByUser.has(u)) {
                // already a key download in progress/queued for this user; its results
                // will be good enough for us.
                logger.log(`downloadKeys: already have a download in progress for ` + `${u}: awaiting its result`);
                promises.push(this.keyDownloadsInProgressByUser.get(u)!);
            } else if (forceDownload || trackingStatus != TrackingStatus.UpToDate) {
                usersToDownload.push(u);
            }
        });

        if (usersToDownload.length != 0) {
            logger.log("downloadKeys: downloading for", usersToDownload);
            const downloadPromise = this.doKeyDownload(usersToDownload);
            promises.push(downloadPromise);
        }

        if (promises.length === 0) {
            logger.log("downloadKeys: already have all necessary keys");
        }

        return Promise.all(promises).then(() => {
            return this.getDevicesFromStore(userIds);
        });
    }

    /**
     * Get the stored device keys for a list of user ids
     *
     * @param userIds - the list of users to list keys for.
     *
     * @returns userId-\>deviceId-\>{@link DeviceInfo}.
     */
    private getDevicesFromStore(userIds: string[]): DeviceInfoMap {
        const stored: DeviceInfoMap = new Map();
        userIds.forEach((userId) => {
            const deviceMap = new Map();
            this.getStoredDevicesForUser(userId)?.forEach(function (device) {
                deviceMap.set(device.deviceId, device);
            });
            stored.set(userId, deviceMap);
        });
        return stored;
    }

    /**
     * Returns a list of all user IDs the DeviceList knows about
     *
     * @returns All known user IDs
     */
    public getKnownUserIds(): string[] {
        return Object.keys(this.devices);
    }

    /**
     * Get the stored device keys for a user id
     *
     * @param userId - the user to list keys for.
     *
     * @returns list of devices, or null if we haven't
     * managed to get a list of devices for this user yet.
     */
    public getStoredDevicesForUser(userId: string): DeviceInfo[] | null {
        const devs = this.devices[userId];
        if (!devs) {
            return null;
        }
        const res: DeviceInfo[] = [];
        for (const deviceId in devs) {
            if (devs.hasOwnProperty(deviceId)) {
                res.push(DeviceInfo.fromStorage(devs[deviceId], deviceId));
            }
        }
        return res;
    }

    /**
     * Get the stored device data for a user, in raw object form
     *
     * @param userId - the user to get data for
     *
     * @returns `deviceId->{object}` devices, or undefined if
     * there is no data for this user.
     */
    public getRawStoredDevicesForUser(userId: string): Record<string, IDevice> {
        return this.devices[userId];
    }

    public getStoredCrossSigningForUser(userId: string): CrossSigningInfo | null {
        if (!this.crossSigningInfo[userId]) return null;

        return CrossSigningInfo.fromStorage(this.crossSigningInfo[userId], userId);
    }

    public storeCrossSigningForUser(userId: string, info: ICrossSigningInfo): void {
        this.crossSigningInfo[userId] = info;
        this.dirty = true;
    }

    /**
     * Get the stored keys for a single device
     *
     *
     * @returns device, or undefined
     * if we don't know about this device
     */
    public getStoredDevice(userId: string, deviceId: string): DeviceInfo | undefined {
        const devs = this.devices[userId];
        if (!devs?.[deviceId]) {
            return undefined;
        }
        return DeviceInfo.fromStorage(devs[deviceId], deviceId);
    }

    /**
     * Get a user ID by one of their device's curve25519 identity key
     *
     * @param algorithm -  encryption algorithm
     * @param senderKey -  curve25519 key to match
     *
     * @returns user ID
     */
    public getUserByIdentityKey(algorithm: string, senderKey: string): string | null {
        if (algorithm !== olmlib.OLM_ALGORITHM && algorithm !== olmlib.MEGOLM_ALGORITHM) {
            // we only deal in olm keys
            return null;
        }

        return this.userByIdentityKey[senderKey];
    }

    /**
     * Find a device by curve25519 identity key
     *
     * @param algorithm -  encryption algorithm
     * @param senderKey -  curve25519 key to match
     */
    public getDeviceByIdentityKey(algorithm: string, senderKey: string): DeviceInfo | null {
        const userId = this.getUserByIdentityKey(algorithm, senderKey);
        if (!userId) {
            return null;
        }

        const devices = this.devices[userId];
        if (!devices) {
            return null;
        }

        for (const deviceId in devices) {
            if (!devices.hasOwnProperty(deviceId)) {
                continue;
            }

            const device = devices[deviceId];
            for (const keyId in device.keys) {
                if (!device.keys.hasOwnProperty(keyId)) {
                    continue;
                }
                if (keyId.indexOf("curve25519:") !== 0) {
                    continue;
                }
                const deviceKey = device.keys[keyId];
                if (deviceKey == senderKey) {
                    return DeviceInfo.fromStorage(device, deviceId);
                }
            }
        }

        // doesn't match a known device
        return null;
    }

    /**
     * Replaces the list of devices for a user with the given device list
     *
     * @param userId - The user ID
     * @param devices - New device info for user
     */
    public storeDevicesForUser(userId: string, devices: Record<string, IDevice>): void {
        this.setRawStoredDevicesForUser(userId, devices);
        this.dirty = true;
    }

    /**
     * flag the given user for device-list tracking, if they are not already.
     *
     * This will mean that a subsequent call to refreshOutdatedDeviceLists()
     * will download the device list for the user, and that subsequent calls to
     * invalidateUserDeviceList will trigger more updates.
     *
     */
    public startTrackingDeviceList(userId: string): void {
        // sanity-check the userId. This is mostly paranoia, but if synapse
        // can't parse the userId we give it as an mxid, it 500s the whole
        // request and we can never update the device lists again (because
        // the broken userId is always 'invalid' and always included in any
        // refresh request).
        // By checking it is at least a string, we can eliminate a class of
        // silly errors.
        if (typeof userId !== "string") {
            throw new Error("userId must be a string; was " + userId);
        }
        if (!this.deviceTrackingStatus[userId]) {
            logger.log("Now tracking device list for " + userId);
            this.deviceTrackingStatus[userId] = TrackingStatus.PendingDownload;
            // we don't yet persist the tracking status, since there may be a lot
            // of calls; we save all data together once the sync is done
            this.dirty = true;
        }
    }

    /**
     * Mark the given user as no longer being tracked for device-list updates.
     *
     * This won't affect any in-progress downloads, which will still go on to
     * complete; it will just mean that we don't think that we have an up-to-date
     * list for future calls to downloadKeys.
     *
     */
    public stopTrackingDeviceList(userId: string): void {
        if (this.deviceTrackingStatus[userId]) {
            logger.log("No longer tracking device list for " + userId);
            this.deviceTrackingStatus[userId] = TrackingStatus.NotTracked;

            // we don't yet persist the tracking status, since there may be a lot
            // of calls; we save all data together once the sync is done
            this.dirty = true;
        }
    }

    /**
     * Set all users we're currently tracking to untracked
     *
     * This will flag each user whose devices we are tracking as in need of an
     * update.
     */
    public stopTrackingAllDeviceLists(): void {
        for (const userId of Object.keys(this.deviceTrackingStatus)) {
            this.deviceTrackingStatus[userId] = TrackingStatus.NotTracked;
        }
        this.dirty = true;
    }

    /**
     * Mark the cached device list for the given user outdated.
     *
     * If we are not tracking this user's devices, we'll do nothing. Otherwise
     * we flag the user as needing an update.
     *
     * This doesn't actually set off an update, so that several users can be
     * batched together. Call refreshOutdatedDeviceLists() for that.
     *
     */
    public invalidateUserDeviceList(userId: string): void {
        if (this.deviceTrackingStatus[userId]) {
            logger.log("Marking device list outdated for", userId);
            this.deviceTrackingStatus[userId] = TrackingStatus.PendingDownload;

            // we don't yet persist the tracking status, since there may be a lot
            // of calls; we save all data together once the sync is done
            this.dirty = true;
        }
    }

    /**
     * If we have users who have outdated device lists, start key downloads for them
     *
     * @returns which completes when the download completes; normally there
     *    is no need to wait for this (it's mostly for the unit tests).
     */
    public refreshOutdatedDeviceLists(): Promise<void> {
        this.saveIfDirty();

        const usersToDownload: string[] = [];
        for (const userId of Object.keys(this.deviceTrackingStatus)) {
            const stat = this.deviceTrackingStatus[userId];
            if (stat == TrackingStatus.PendingDownload) {
                usersToDownload.push(userId);
            }
        }

        return this.doKeyDownload(usersToDownload);
    }

    /**
     * Set the stored device data for a user, in raw object form
     * Used only by internal class DeviceListUpdateSerialiser
     *
     * @param userId - the user to get data for
     *
     * @param devices - `deviceId->{object}` the new devices
     */
    public setRawStoredDevicesForUser(userId: string, devices: Record<string, IDevice>): void {
        // remove old devices from userByIdentityKey
        if (this.devices[userId] !== undefined) {
            for (const [deviceId, dev] of Object.entries(this.devices[userId])) {
                const identityKey = dev.keys["curve25519:" + deviceId];

                delete this.userByIdentityKey[identityKey];
            }
        }

        this.devices[userId] = devices;

        // add new devices into userByIdentityKey
        for (const [deviceId, dev] of Object.entries(devices)) {
            const identityKey = dev.keys["curve25519:" + deviceId];

            this.userByIdentityKey[identityKey] = userId;
        }
    }

    public setRawStoredCrossSigningForUser(userId: string, info: ICrossSigningInfo): void {
        this.crossSigningInfo[userId] = info;
    }

    /**
     * Fire off download update requests for the given users, and update the
     * device list tracking status for them, and the
     * keyDownloadsInProgressByUser map for them.
     *
     * @param users -  list of userIds
     *
     * @returns resolves when all the users listed have
     *     been updated. rejects if there was a problem updating any of the
     *     users.
     */
    private doKeyDownload(users: string[]): Promise<void> {
        if (users.length === 0) {
            // nothing to do
            return Promise.resolve();
        }

        const prom = this.serialiser.updateDevicesForUsers(users, this.syncToken!).then(
            () => {
                finished(true);
            },
            (e) => {
                logger.error("Error downloading keys for " + users + ":", e);
                finished(false);
                throw e;
            },
        );

        users.forEach((u) => {
            this.keyDownloadsInProgressByUser.set(u, prom);
            const stat = this.deviceTrackingStatus[u];
            if (stat == TrackingStatus.PendingDownload) {
                this.deviceTrackingStatus[u] = TrackingStatus.DownloadInProgress;
            }
        });

        const finished = (success: boolean): void => {
            this.emit(CryptoEvent.WillUpdateDevices, users, !this.hasFetched);
            users.forEach((u) => {
                this.dirty = true;

                // we may have queued up another download request for this user
                // since we started this request. If that happens, we should
                // ignore the completion of the first one.
                if (this.keyDownloadsInProgressByUser.get(u) !== prom) {
                    logger.log("Another update in the queue for", u, "- not marking up-to-date");
                    return;
                }
                this.keyDownloadsInProgressByUser.delete(u);
                const stat = this.deviceTrackingStatus[u];
                if (stat == TrackingStatus.DownloadInProgress) {
                    if (success) {
                        // we didn't get any new invalidations since this download started:
                        // this user's device list is now up to date.
                        this.deviceTrackingStatus[u] = TrackingStatus.UpToDate;
                        logger.log("Device list for", u, "now up to date");
                    } else {
                        this.deviceTrackingStatus[u] = TrackingStatus.PendingDownload;
                    }
                }
            });
            this.saveIfDirty();
            this.emit(CryptoEvent.DevicesUpdated, users, !this.hasFetched);
            this.hasFetched = true;
        };

        return prom;
    }
}

/**
 * Serialises updates to device lists
 *
 * Ensures that results from /keys/query are not overwritten if a second call
 * completes *before* an earlier one.
 *
 * It currently does this by ensuring only one call to /keys/query happens at a
 * time (and queuing other requests up).
 */
class DeviceListUpdateSerialiser {
    private downloadInProgress = false;

    // users which are queued for download
    // userId -> true
    private keyDownloadsQueuedByUser: Record<string, boolean> = {};

    // deferred which is resolved when the queued users are downloaded.
    // non-null indicates that we have users queued for download.
    private queuedQueryDeferred?: IDeferred<void>;

    private syncToken?: string; // The sync token we send with the requests

    /*
     * @param baseApis - Base API object
     * @param olmDevice - The Olm Device
     * @param deviceList - The device list object, the device list to be updated
     */
    public constructor(
        private readonly baseApis: MatrixClient,
        private readonly olmDevice: OlmDevice,
        private readonly deviceList: DeviceList,
    ) {}

    /**
     * Make a key query request for the given users
     *
     * @param users - list of user ids
     *
     * @param syncToken - sync token to pass in the query request, to
     *     help the HS give the most recent results
     *
     * @returns resolves when all the users listed have
     *     been updated. rejects if there was a problem updating any of the
     *     users.
     */
    public updateDevicesForUsers(users: string[], syncToken: string): Promise<void> {
        users.forEach((u) => {
            this.keyDownloadsQueuedByUser[u] = true;
        });

        if (!this.queuedQueryDeferred) {
            this.queuedQueryDeferred = defer();
        }

        // We always take the new sync token and just use the latest one we've
        // been given, since it just needs to be at least as recent as the
        // sync response the device invalidation message arrived in
        this.syncToken = syncToken;

        if (this.downloadInProgress) {
            // just queue up these users
            logger.log("Queued key download for", users);
            return this.queuedQueryDeferred.promise;
        }

        // start a new download.
        return this.doQueuedQueries();
    }

    private doQueuedQueries(): Promise<void> {
        if (this.downloadInProgress) {
            throw new Error("DeviceListUpdateSerialiser.doQueuedQueries called with request active");
        }

        const downloadUsers = Object.keys(this.keyDownloadsQueuedByUser);
        this.keyDownloadsQueuedByUser = {};
        const deferred = this.queuedQueryDeferred;
        this.queuedQueryDeferred = undefined;

        logger.log("Starting key download for", downloadUsers);
        this.downloadInProgress = true;

        const opts: Parameters<MatrixClient["downloadKeysForUsers"]>[1] = {};
        if (this.syncToken) {
            opts.token = this.syncToken;
        }

        const factories: Array<() => Promise<IDownloadKeyResult>> = [];
        for (let i = 0; i < downloadUsers.length; i += this.deviceList.keyDownloadChunkSize) {
            const userSlice = downloadUsers.slice(i, i + this.deviceList.keyDownloadChunkSize);
            factories.push(() => this.baseApis.downloadKeysForUsers(userSlice, opts));
        }

        chunkPromises(factories, 3)
            .then(async (responses: IDownloadKeyResult[]) => {
                const dk: IDownloadKeyResult["device_keys"] = Object.assign(
                    {},
                    ...responses.map((res) => res.device_keys || {}),
                );
                const masterKeys: IDownloadKeyResult["master_keys"] = Object.assign(
                    {},
                    ...responses.map((res) => res.master_keys || {}),
                );
                const ssks: IDownloadKeyResult["self_signing_keys"] = Object.assign(
                    {},
                    ...responses.map((res) => res.self_signing_keys || {}),
                );
                const usks: IDownloadKeyResult["user_signing_keys"] = Object.assign(
                    {},
                    ...responses.map((res) => res.user_signing_keys || {}),
                );

                // yield to other things that want to execute in between users, to
                // avoid wedging the CPU
                // (https://github.com/vector-im/element-web/issues/3158)
                //
                // of course we ought to do this in a web worker or similar, but
                // this serves as an easy solution for now.
                for (const userId of downloadUsers) {
                    await sleep(5);
                    try {
                        await this.processQueryResponseForUser(userId, dk[userId], {
                            master: masterKeys?.[userId],
                            self_signing: ssks?.[userId],
                            user_signing: usks?.[userId],
                        });
                    } catch (e) {
                        // log the error but continue, so that one bad key
                        // doesn't kill the whole process
                        logger.error(`Error processing keys for ${userId}:`, e);
                    }
                }
            })
            .then(
                () => {
                    logger.log("Completed key download for " + downloadUsers);

                    this.downloadInProgress = false;
                    deferred?.resolve();

                    // if we have queued users, fire off another request.
                    if (this.queuedQueryDeferred) {
                        this.doQueuedQueries();
                    }
                },
                (e) => {
                    logger.warn("Error downloading keys for " + downloadUsers + ":", e);
                    this.downloadInProgress = false;
                    deferred?.reject(e);
                },
            );

        return deferred!.promise;
    }

    private async processQueryResponseForUser(
        userId: string,
        dkResponse: DeviceKeys,
        crossSigningResponse: {
            master?: Keys;
            self_signing?: SigningKeys;
            user_signing?: SigningKeys;
        },
    ): Promise<void> {
        logger.log("got device keys for " + userId + ":", dkResponse);
        logger.log("got cross-signing keys for " + userId + ":", crossSigningResponse);

        {
            // map from deviceid -> deviceinfo for this user
            const userStore: Record<string, DeviceInfo> = {};
            const devs = this.deviceList.getRawStoredDevicesForUser(userId);
            if (devs) {
                Object.keys(devs).forEach((deviceId) => {
                    const d = DeviceInfo.fromStorage(devs[deviceId], deviceId);
                    userStore[deviceId] = d;
                });
            }

            await updateStoredDeviceKeysForUser(
                this.olmDevice,
                userId,
                userStore,
                dkResponse || {},
                this.baseApis.getUserId()!,
                this.baseApis.deviceId!,
            );

            // put the updates into the object that will be returned as our results
            const storage: Record<string, IDevice> = {};
            Object.keys(userStore).forEach((deviceId) => {
                storage[deviceId] = userStore[deviceId].toStorage();
            });

            this.deviceList.setRawStoredDevicesForUser(userId, storage);
        }

        // now do the same for the cross-signing keys
        {
            // FIXME: should we be ignoring empty cross-signing responses, or
            // should we be dropping the keys?
            if (
                crossSigningResponse &&
                (crossSigningResponse.master || crossSigningResponse.self_signing || crossSigningResponse.user_signing)
            ) {
                const crossSigning =
                    this.deviceList.getStoredCrossSigningForUser(userId) || new CrossSigningInfo(userId);

                crossSigning.setKeys(crossSigningResponse);

                this.deviceList.setRawStoredCrossSigningForUser(userId, crossSigning.toStorage());

                // NB. Unlike most events in the js-sdk, this one is internal to the
                // js-sdk and is not re-emitted
                this.deviceList.emit(CryptoEvent.UserCrossSigningUpdated, userId);
            }
        }
    }
}

async function updateStoredDeviceKeysForUser(
    olmDevice: OlmDevice,
    userId: string,
    userStore: Record<string, DeviceInfo>,
    userResult: IDownloadKeyResult["device_keys"]["user_id"],
    localUserId: string,
    localDeviceId: string,
): Promise<boolean> {
    let updated = false;

    // remove any devices in the store which aren't in the response
    for (const deviceId in userStore) {
        if (!userStore.hasOwnProperty(deviceId)) {
            continue;
        }

        if (!(deviceId in userResult)) {
            if (userId === localUserId && deviceId === localDeviceId) {
                logger.warn(`Local device ${deviceId} missing from sync, skipping removal`);
                continue;
            }

            logger.log("Device " + userId + ":" + deviceId + " has been removed");
            delete userStore[deviceId];
            updated = true;
        }
    }

    for (const deviceId in userResult) {
        if (!userResult.hasOwnProperty(deviceId)) {
            continue;
        }

        const deviceResult = userResult[deviceId];

        // check that the user_id and device_id in the response object are
        // correct
        if (deviceResult.user_id !== userId) {
            logger.warn("Mismatched user_id " + deviceResult.user_id + " in keys from " + userId + ":" + deviceId);
            continue;
        }
        if (deviceResult.device_id !== deviceId) {
            logger.warn("Mismatched device_id " + deviceResult.device_id + " in keys from " + userId + ":" + deviceId);
            continue;
        }

        if (await storeDeviceKeys(olmDevice, userStore, deviceResult)) {
            updated = true;
        }
    }

    return updated;
}

/*
 * Process a device in a /query response, and add it to the userStore
 *
 * returns (a promise for) true if a change was made, else false
 */
async function storeDeviceKeys(
    olmDevice: OlmDevice,
    userStore: Record<string, DeviceInfo>,
    deviceResult: IDownloadKeyResult["device_keys"]["user_id"]["device_id"],
): Promise<boolean> {
    if (!deviceResult.keys) {
        // no keys?
        return false;
    }

    const deviceId = deviceResult.device_id;
    const userId = deviceResult.user_id;

    const signKeyId = "ed25519:" + deviceId;
    const signKey = deviceResult.keys[signKeyId];
    if (!signKey) {
        logger.warn("Device " + userId + ":" + deviceId + " has no ed25519 key");
        return false;
    }

    const unsigned = deviceResult.unsigned || {};
    const signatures = deviceResult.signatures || {};

    try {
        await olmlib.verifySignature(olmDevice, deviceResult, userId, deviceId, signKey);
    } catch (e) {
        logger.warn("Unable to verify signature on device " + userId + ":" + deviceId + ":" + e);
        return false;
    }

    // DeviceInfo
    let deviceStore;

    if (deviceId in userStore) {
        // already have this device.
        deviceStore = userStore[deviceId];

        if (deviceStore.getFingerprint() != signKey) {
            // this should only happen if the list has been MITMed; we are
            // best off sticking with the original keys.
            //
            // Should we warn the user about it somehow?
            logger.warn("Ed25519 key for device " + userId + ":" + deviceId + " has changed");
            return false;
        }
    } else {
        userStore[deviceId] = deviceStore = new DeviceInfo(deviceId);
    }

    deviceStore.keys = deviceResult.keys || {};
    deviceStore.algorithms = deviceResult.algorithms || [];
    deviceStore.unsigned = unsigned;
    deviceStore.signatures = signatures;
    return true;
}
