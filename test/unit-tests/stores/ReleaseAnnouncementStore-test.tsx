/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";

import SettingsStore, { type CallbackFn } from "../../../src/settings/SettingsStore";
import { type Feature, ReleaseAnnouncementStore } from "../../../src/stores/ReleaseAnnouncementStore";
import { type SettingLevel } from "../../../src/settings/SettingLevel";

jest.mock("../../../src/settings/SettingsStore");

describe("ReleaseAnnouncementStore", () => {
    let releaseAnnouncementStore: ReleaseAnnouncementStore;
    // Local settings
    // Instead of using the real SettingsStore, we use a local settings object
    // to avoid side effects between tests
    let settings: Record<string, any> = {};

    beforeEach(() => {
        // Default settings
        settings = {
            feature_release_announcement: true,
            releaseAnnouncementData: {},
        };
        const watchCallbacks: Array<CallbackFn> = [];

        mocked(SettingsStore.getValue).mockImplementation((setting: string) => {
            return settings[setting];
        });
        mocked(SettingsStore.setValue).mockImplementation(
            (settingName: string, roomId: string | null, level: SettingLevel, value: any): Promise<void> => {
                settings[settingName] = value;
                // we don't care about the parameters, just call the callbacks
                // @ts-ignore
                watchCallbacks.forEach((cb) => cb());
                return Promise.resolve();
            },
        );
        mocked(SettingsStore.isLevelSupported).mockReturnValue(true);
        mocked(SettingsStore.canSetValue).mockReturnValue(true);
        mocked(SettingsStore.watchSetting).mockImplementation((settingName: string, roomId: null, callback: any) => {
            watchCallbacks.push(callback);
            return "watcherId";
        });

        releaseAnnouncementStore = new ReleaseAnnouncementStore();
    });

    /**
     * Disables the release announcement feature.
     */
    function disableReleaseAnnouncement() {
        settings["feature_release_announcement"] = false;
    }

    /**
     * Listens to the next release announcement change event.
     */
    function listenReleaseAnnouncementChanged() {
        return new Promise<Feature | null>((resolve) =>
            releaseAnnouncementStore.once("releaseAnnouncementChanged", resolve),
        );
    }

    it("should be a singleton", () => {
        expect(ReleaseAnnouncementStore.instance).toBeDefined();
    });

    it("should return null when the release announcement is disabled", async () => {
        disableReleaseAnnouncement();

        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBeNull();

        // Wait for the next release announcement change event
        const promise = listenReleaseAnnouncementChanged();
        // Call the next release announcement
        // because the release announcement is disabled, the next release announcement should be null
        await releaseAnnouncementStore.nextReleaseAnnouncement();
        expect(await promise).toBeNull();
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBeNull();
    });

    it("should return the next feature when the next release announcement is called", async () => {
        // Sanity check
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBe("threadsActivityCentre");

        let promise = listenReleaseAnnouncementChanged();
        await releaseAnnouncementStore.nextReleaseAnnouncement();

        expect(await promise).toBe("pinningMessageList");
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBe("pinningMessageList");

        promise = listenReleaseAnnouncementChanged();
        await releaseAnnouncementStore.nextReleaseAnnouncement();

        expect(await promise).toBeNull();
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBeNull();

        const secondStore = new ReleaseAnnouncementStore();
        // All the release announcements have been viewed, so it should be updated in the store account
        // The release announcement viewing states should be share among all instances (devices in the same account)
        expect(secondStore.getReleaseAnnouncement()).toBeNull();
    });

    it("should listen to release announcement data changes in the store", async () => {
        const secondStore = new ReleaseAnnouncementStore();
        expect(secondStore.getReleaseAnnouncement()).toBe("threadsActivityCentre");

        const promise = listenReleaseAnnouncementChanged();
        await secondStore.nextReleaseAnnouncement();

        expect(await promise).toBe("pinningMessageList");
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBe("pinningMessageList");
    });
});
