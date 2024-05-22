/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import { mocked } from "jest-mock";

import SettingsStore, { CallbackFn } from "../../src/settings/SettingsStore";
import { Feature, ReleaseAnnouncementStore } from "../../src/stores/ReleaseAnnouncementStore";
import { SettingLevel } from "../../src/settings/SettingLevel";

jest.mock("../../src/settings/SettingsStore");

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

        const promise = listenReleaseAnnouncementChanged();
        await releaseAnnouncementStore.nextReleaseAnnouncement();
        // Currently there is only one feature, so the next feature should be null
        expect(await promise).toBeNull();
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBeNull();

        const secondStore = new ReleaseAnnouncementStore();
        // The TAC release announcement has been viewed, so it should be updated in the store account
        // The release announcement viewing states should be share among all instances (devices in the same account)
        expect(secondStore.getReleaseAnnouncement()).toBeNull();
    });

    it("should listen to release announcement data changes in the store", async () => {
        const secondStore = new ReleaseAnnouncementStore();
        expect(secondStore.getReleaseAnnouncement()).toBe("threadsActivityCentre");

        const promise = listenReleaseAnnouncementChanged();
        await secondStore.nextReleaseAnnouncement();

        // Currently there is only one feature, so the next feature should be null
        expect(await promise).toBeNull();
        expect(releaseAnnouncementStore.getReleaseAnnouncement()).toBeNull();
    });
});
