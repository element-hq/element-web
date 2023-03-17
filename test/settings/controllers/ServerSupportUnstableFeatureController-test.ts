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

import { defer } from "matrix-js-sdk/src/utils";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import ServerSupportUnstableFeatureController from "../../../src/settings/controllers/ServerSupportUnstableFeatureController";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { LabGroup, SETTINGS } from "../../../src/settings/Settings";
import { stubClient } from "../../test-utils";
import { WatchManager } from "../../../src/settings/WatchManager";
import MatrixClientBackedController from "../../../src/settings/controllers/MatrixClientBackedController";

describe("ServerSupportUnstableFeatureController", () => {
    const watchers = new WatchManager();
    const setting = "setting_name";

    async function prepareSetting(
        cli: MatrixClient,
        controller: ServerSupportUnstableFeatureController,
    ): Promise<void> {
        SETTINGS[setting] = {
            isFeature: true,
            labsGroup: LabGroup.Messaging,
            displayName: "name of some kind",
            supportedLevels: [SettingLevel.DEVICE, SettingLevel.CONFIG],
            default: false,
            controller,
        };

        const deferred = defer<any>();
        watchers.watchSetting(setting, null, deferred.resolve);
        MatrixClientBackedController.matrixClient = cli;
        await deferred.promise;
    }

    describe("getValueOverride()", () => {
        it("should return forced value is setting is disabled", async () => {
            const cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async () => false);

            const controller = new ServerSupportUnstableFeatureController(
                setting,
                watchers,
                [["feature"]],
                undefined,
                undefined,
                "other_value",
            );
            await prepareSetting(cli, controller);

            expect(controller.getValueOverride(SettingLevel.DEVICE, null, true, SettingLevel.ACCOUNT)).toEqual(
                "other_value",
            );
        });

        it("should pass through to the handler if setting is not disabled", async () => {
            const cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async () => true);

            const controller = new ServerSupportUnstableFeatureController(
                setting,
                watchers,
                [["feature"]],
                "other_value",
            );
            await prepareSetting(cli, controller);

            expect(controller.getValueOverride(SettingLevel.DEVICE, null, true, SettingLevel.ACCOUNT)).toEqual(null);
        });
    });

    describe("settingDisabled()", () => {
        it("considered disabled if there is no matrix client", () => {
            const controller = new ServerSupportUnstableFeatureController(setting, watchers, [["org.matrix.msc3030"]]);
            expect(controller.settingDisabled).toEqual(true);
        });

        it("considered disabled if not all required features in the only feature group are supported", async () => {
            const cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async (featureName) => {
                return featureName === "org.matrix.msc3827.stable";
            });

            const controller = new ServerSupportUnstableFeatureController(setting, watchers, [
                ["org.matrix.msc3827.stable", "org.matrix.msc3030"],
            ]);
            await prepareSetting(cli, controller);

            expect(controller.settingDisabled).toEqual(true);
        });

        it("considered enabled if all required features in the only feature group are supported", async () => {
            const cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async (featureName) => {
                return featureName === "org.matrix.msc3827.stable" || featureName === "org.matrix.msc3030";
            });
            const controller = new ServerSupportUnstableFeatureController(setting, watchers, [
                ["org.matrix.msc3827.stable", "org.matrix.msc3030"],
            ]);
            await prepareSetting(cli, controller);

            expect(controller.settingDisabled).toEqual(false);
        });

        it("considered enabled if all required features in one of the feature groups are supported", async () => {
            const cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async (featureName) => {
                return featureName === "org.matrix.msc3827.stable" || featureName === "org.matrix.msc3030";
            });
            const controller = new ServerSupportUnstableFeatureController(setting, watchers, [
                ["foo-unsupported", "bar-unsupported"],
                ["org.matrix.msc3827.stable", "org.matrix.msc3030"],
            ]);
            await prepareSetting(cli, controller);

            expect(controller.settingDisabled).toEqual(false);
        });

        it("considered disabled if not all required features in one of the feature groups are supported", async () => {
            const cli = stubClient();
            cli.doesServerSupportUnstableFeature = jest.fn(async (featureName) => {
                return featureName === "org.matrix.msc3827.stable";
            });

            const controller = new ServerSupportUnstableFeatureController(setting, watchers, [
                ["foo-unsupported", "bar-unsupported"],
                ["org.matrix.msc3827.stable", "org.matrix.msc3030"],
            ]);
            await prepareSetting(cli, controller);

            expect(controller.settingDisabled).toEqual(true);
        });
    });
});
