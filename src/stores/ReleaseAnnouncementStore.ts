/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { cloneDeep } from "lodash";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import { Features } from "../settings/Settings";

/**
 * The features are shown in the array order.
 */
const FEATURES = ["threadsActivityCentre", "pinningMessageList"] as const;
/**
 * All the features that can be shown in the release announcements.
 */
export type Feature = (typeof FEATURES)[number];
/**
 * The stored settings for the release announcements.
 * The boolean is at true when the user has viewed the feature
 */
type StoredSettings = Partial<Record<Feature, boolean>>;

export type ReleaseAnnouncementData = StoredSettings;

/**
 * The events emitted by the ReleaseAnnouncementStore.
 */
type ReleaseAnnouncementStoreEvents = "releaseAnnouncementChanged";
/**
 * The handlers for the ReleaseAnnouncementStore events.
 */
type HandlerMap = {
    releaseAnnouncementChanged: (newFeature: Feature | null) => void;
};

/**
 * The ReleaseAnnouncementStore is responsible for managing the release announcements.
 * It keeps track of the viewed release announcements and emits events when the release announcement changes.
 */
export class ReleaseAnnouncementStore extends TypedEventEmitter<ReleaseAnnouncementStoreEvents, HandlerMap> {
    /**
     * The singleton instance of the ReleaseAnnouncementStore.
     * @private
     */
    private static internalInstance: ReleaseAnnouncementStore;
    /**
     * The index of the feature to show.
     * @private
     */
    private index = 0;

    /**
     * The singleton instance of the ReleaseAnnouncementStore.
     */
    public static get instance(): ReleaseAnnouncementStore {
        if (!ReleaseAnnouncementStore.internalInstance) {
            ReleaseAnnouncementStore.internalInstance = new ReleaseAnnouncementStore();
        }
        return ReleaseAnnouncementStore.internalInstance;
    }

    /**
     * Should be used only for testing purposes.
     * @internal
     */
    public constructor() {
        super();
        SettingsStore.watchSetting("releaseAnnouncementData", null, () => {
            this.emit("releaseAnnouncementChanged", this.getReleaseAnnouncement());
        });
    }

    /**
     * Get the viewed release announcements from the settings.
     * @private
     */
    private getViewedReleaseAnnouncements(): StoredSettings {
        // Clone the settings to avoid to mutate the internal stored value in the SettingsStore
        return cloneDeep(SettingsStore.getValue("releaseAnnouncementData"));
    }

    /**
     * Check if the release announcement is enabled.
     * @private
     */
    private isReleaseAnnouncementEnabled(): boolean {
        return SettingsStore.getValue(Features.ReleaseAnnouncement);
    }

    /**
     * Get the release announcement that should be displayed
     * @returns The feature to announce or null if there is no feature to announce
     */
    public getReleaseAnnouncement(): Feature | null {
        // Do nothing if the release announcement is disabled
        const isReleaseAnnouncementEnabled = this.isReleaseAnnouncementEnabled();
        if (!isReleaseAnnouncementEnabled) return null;

        const viewedReleaseAnnouncements = this.getViewedReleaseAnnouncements();

        // Find the first feature that has not been viewed
        for (let i = this.index; i < FEATURES.length; i++) {
            if (!viewedReleaseAnnouncements[FEATURES[i]]) {
                this.index = i;
                return FEATURES[this.index];
            }
        }

        // All features have been viewed
        return null;
    }

    /**
     * Mark the current release announcement as viewed.
     * This will update the account settings
     * @private
     */
    private async markReleaseAnnouncementAsViewed(): Promise<void> {
        // Do nothing if the release announcement is disabled
        const isReleaseAnnouncementEnabled = this.isReleaseAnnouncementEnabled();
        if (!isReleaseAnnouncementEnabled) return;

        const viewedReleaseAnnouncements = this.getViewedReleaseAnnouncements();

        // If the index is out of bounds, do nothing
        // Normally it shouldn't happen, but it's better to be safe
        const feature = FEATURES[this.index];
        if (!feature) return;

        // Mark the feature as viewed
        viewedReleaseAnnouncements[FEATURES[this.index]] = true;
        this.index++;

        // Do sanity check if we can store the new value in the settings
        const isSupported = SettingsStore.isLevelSupported(SettingLevel.ACCOUNT);
        if (!isSupported) return;

        const canSetValue = SettingsStore.canSetValue("releaseAnnouncementData", null, SettingLevel.ACCOUNT);
        if (canSetValue) {
            try {
                await SettingsStore.setValue(
                    "releaseAnnouncementData",
                    null,
                    SettingLevel.ACCOUNT,
                    viewedReleaseAnnouncements,
                );
            } catch (e) {
                logger.log("Failed to set release announcement settings", e);
            }
        }
    }

    /**
     * Mark the current release announcement as viewed and move to the next release announcement.
     * This will update the account settings and emit the `releaseAnnouncementChanged` event
     */
    public async nextReleaseAnnouncement(): Promise<void> {
        await this.markReleaseAnnouncementAsViewed();

        this.emit("releaseAnnouncementChanged", this.getReleaseAnnouncement());
    }
}
