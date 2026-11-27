/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import UIComponentController from "./UIComponentController";
import SettingController from "./SettingController";
import { SettingLevel } from "../SettingLevel";
import SettingsStore from "../SettingsStore";
import { UIComponent, UIFeature } from "../UIFeature";
import { CustomisationsApi } from "../../modules/customisationsApi";

describe("UIComponentController", () => {
    let customisations: CustomisationsApi;

    beforeEach(() => {
        customisations = new CustomisationsApi();
        SettingController.moduleCustomisations = customisations;
    });

    afterEach(() => {
        SettingController.moduleCustomisations = undefined;
    });

    const hidePublicRooms = (): void => {
        customisations.registerShouldShowComponent((component) =>
            component === UIComponent.PublicRooms ? false : undefined,
        );
    };

    const getOverride = (controller: UIComponentController): any =>
        controller.getValueOverride(SettingLevel.CONFIG, null, true, SettingLevel.CONFIG);

    it("does not override the value if the module API hasn't been created", () => {
        SettingController.moduleCustomisations = undefined;
        expect(getOverride(new UIComponentController(UIComponent.PublicRooms))).toBeNull();
    });

    it("does not override the value if no module hides the component", () => {
        customisations.registerShouldShowComponent(() => undefined);
        const controller = new UIComponentController(UIComponent.PublicRooms);
        expect(getOverride(controller)).toBeNull();
        expect(controller.settingDisabled).toBe(false);
    });

    it("does not override the value if a module shows the component", () => {
        customisations.registerShouldShowComponent(() => true);
        expect(getOverride(new UIComponentController(UIComponent.PublicRooms))).toBeNull();
    });

    it("forces the value to false if a module hides the component", () => {
        hidePublicRooms();
        const controller = new UIComponentController(UIComponent.PublicRooms);
        expect(getOverride(controller)).toBe(false);
        expect(controller.settingDisabled).toBe(true);
    });

    it.each([UIFeature.AllowCreatingPublicRooms, UIFeature.AllowCreatingPublicSpaces])(
        "disables %s when a module hides public rooms",
        (setting) => {
            expect(SettingsStore.getValue(setting)).toBe(true);
            hidePublicRooms();
            expect(SettingsStore.getValue(setting)).toBe(false);
        },
    );
});
