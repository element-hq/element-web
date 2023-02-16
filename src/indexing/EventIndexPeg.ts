/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

/*
 * Object holding the global EventIndex object. Can only be initialized if the
 * platform supports event indexing.
 */

import { logger } from "matrix-js-sdk/src/logger";

import PlatformPeg from "../PlatformPeg";
import EventIndex from "../indexing/EventIndex";
import { MatrixClientPeg } from "../MatrixClientPeg";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";

const INDEX_VERSION = 1;

/**
 * Holds the current instance of the `EventIndex` to use across the codebase.
 * Looking for an `EventIndex`? Just look for the `EventIndexPeg` on the peg
 * board. "Peg" is the literal meaning of something you hang something on. So
 * you'll find a `EventIndex` hanging on the `EventIndexPeg`.
 */
export class EventIndexPeg {
    public index: EventIndex | null = null;
    public error: Error | null = null;

    private _supportIsInstalled = false;

    /**
     * Initialize the EventIndexPeg and if event indexing is enabled initialize
     * the event index.
     *
     * @return {Promise<boolean>} A promise that will resolve to true if an
     * EventIndex was successfully initialized, false otherwise.
     */
    public async init(): Promise<boolean> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        if (!indexManager) {
            logger.log("EventIndex: Platform doesn't support event indexing, not initializing.");
            return false;
        }

        this._supportIsInstalled = await indexManager.supportsEventIndexing();

        if (!this.supportIsInstalled()) {
            logger.log("EventIndex: Event indexing isn't installed for the platform, not initializing.");
            return false;
        }

        if (!SettingsStore.getValueAt(SettingLevel.DEVICE, "enableEventIndexing")) {
            logger.log("EventIndex: Event indexing is disabled, not initializing");
            return false;
        }

        return this.initEventIndex();
    }

    /**
     * Initialize the event index.
     *
     * @returns {boolean} True if the event index was successfully initialized,
     * false otherwise.
     */
    public async initEventIndex(): Promise<boolean> {
        const index = new EventIndex();
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();
        const client = MatrixClientPeg.get();
        if (!indexManager || !client) {
            throw new Error("Unable to init event index");
        }

        const userId = client.getUserId()!;
        const deviceId = client.getDeviceId()!;

        try {
            await indexManager.initEventIndex(userId, deviceId);

            const userVersion = await indexManager.getUserVersion();
            const eventIndexIsEmpty = await indexManager.isEventIndexEmpty();

            if (eventIndexIsEmpty) {
                await indexManager.setUserVersion(INDEX_VERSION);
            } else if (userVersion === 0 && !eventIndexIsEmpty) {
                await indexManager.closeEventIndex();
                await this.deleteEventIndex();

                await indexManager.initEventIndex(userId, deviceId);
                await indexManager.setUserVersion(INDEX_VERSION);
            }

            logger.log("EventIndex: Successfully initialized the event index");
            await index.init();
        } catch (e) {
            logger.log("EventIndex: Error initializing the event index", e);
            this.error = e;
            return false;
        }

        this.index = index;

        return true;
    }

    /**
     * Check if the current platform has support for event indexing.
     *
     * @return {boolean} True if it has support, false otherwise. Note that this
     * does not mean that support is installed.
     */
    public platformHasSupport(): boolean {
        return PlatformPeg.get()?.getEventIndexingManager() != null;
    }

    /**
     * Check if event indexing support is installed for the platform.
     *
     * Event indexing might require additional optional modules to be installed,
     * this tells us if those are installed. Note that this should only be
     * called after the init() method was called.
     *
     * @return {boolean} True if support is installed, false otherwise.
     */
    public supportIsInstalled(): boolean {
        return this._supportIsInstalled;
    }

    /**
     * Get the current event index.
     *
     * @return {EventIndex} The current event index.
     */
    public get(): EventIndex | null {
        return this.index;
    }

    public start(): void {
        if (this.index === null) return;
        this.index.startCrawler();
    }

    public stop(): void {
        if (this.index === null) return;
        this.index.stopCrawler();
    }

    /**
     * Unset our event store
     *
     * After a call to this the init() method will need to be called again.
     *
     * @return {Promise} A promise that will resolve once the event index is
     * closed.
     */
    public async unset(): Promise<void> {
        if (this.index === null) return;
        await this.index.close();
        this.index = null;
    }

    /**
     * Delete our event indexer.
     *
     * After a call to this the init() method will need to be called again.
     *
     * @return {Promise} A promise that will resolve once the event index is
     * deleted.
     */
    public async deleteEventIndex(): Promise<void> {
        const indexManager = PlatformPeg.get()?.getEventIndexingManager();

        if (indexManager) {
            await this.unset();
            logger.log("EventIndex: Deleting event index.");
            await indexManager.deleteEventIndex();
        }
    }
}

if (!window.mxEventIndexPeg) {
    window.mxEventIndexPeg = new EventIndexPeg();
}
export default window.mxEventIndexPeg;
