/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import QuickThemeSwitcher from "../../../../src/components/views/spaces/QuickThemeSwitcher";
import { getOrderedThemes } from "../../../../src/theme";
import ThemeChoicePanel from "../../../../src/components/views/settings/ThemeChoicePanel";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import dis from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { mockPlatformPeg } from "../../../test-utils/platform";

jest.mock("../../../../src/theme");
jest.mock("../../../../src/components/views/settings/ThemeChoicePanel", () => ({
    calculateThemeState: jest.fn(),
}));
jest.mock("../../../../src/settings/SettingsStore", () => ({
    setValue: jest.fn(),
    getValue: jest.fn(),
    monitorSetting: jest.fn(),
    watchSetting: jest.fn(),
}));

jest.mock("../../../../src/dispatcher/dispatcher", () => ({
    dispatch: jest.fn(),
    register: jest.fn(),
}));

mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });

describe("<QuickThemeSwitcher />", () => {
    const defaultProps = {
        requestClose: jest.fn(),
    };
    const renderComponent = (props = {}) => render(<QuickThemeSwitcher {...defaultProps} {...props} />);

    beforeEach(() => {
        mocked(getOrderedThemes)
            .mockClear()
            .mockReturnValue([
                { id: "light", name: "Light" },
                { id: "dark", name: "Dark" },
            ]);
        mocked(ThemeChoicePanel).calculateThemeState.mockClear().mockReturnValue({
            theme: "light",
            useSystemTheme: false,
        });
        mocked(SettingsStore).setValue.mockClear().mockResolvedValue();
        mocked(dis).dispatch.mockClear();
    });

    const selectFromDropdown = async (getByTextArg: RegExp | string) => {
        const dropdown = screen.getByRole("button", { name: "Space selection" });
        await userEvent.click(dropdown);
        await waitFor(() => {
            expect(dropdown).toHaveAttribute("aria-expanded", "true");
        });
        await userEvent.click(screen.getByText(getByTextArg));
        return waitFor(() => {
            expect(dropdown).toHaveAttribute("aria-expanded", "false");
        });
    };

    it("renders dropdown correctly when light theme is selected", () => {
        renderComponent();
        expect(screen.getByText("Light")).toBeInTheDocument();
    });

    it("renders dropdown correctly when use system theme is truthy", () => {
        mocked(ThemeChoicePanel).calculateThemeState.mockClear().mockReturnValue({
            theme: "light",
            useSystemTheme: true,
        });
        renderComponent();
        expect(screen.getByText("Match system")).toBeInTheDocument();
    });

    it("updates settings when match system is selected", async () => {
        const requestClose = jest.fn();
        renderComponent({ requestClose });

        await selectFromDropdown(/match system/i);

        expect(SettingsStore.setValue).toHaveBeenCalledTimes(1);
        expect(SettingsStore.setValue).toHaveBeenCalledWith("use_system_theme", null, SettingLevel.DEVICE, true);

        expect(dis.dispatch).not.toHaveBeenCalled();
        expect(requestClose).toHaveBeenCalled();
    });

    it("updates settings when a theme is selected", async () => {
        // ie not match system
        const requestClose = jest.fn();
        renderComponent({ requestClose });

        await selectFromDropdown(/dark/i);

        expect(SettingsStore.setValue).toHaveBeenCalledWith("use_system_theme", null, SettingLevel.DEVICE, false);
        expect(SettingsStore.setValue).toHaveBeenCalledWith("theme", null, SettingLevel.DEVICE, "dark");

        expect(dis.dispatch).toHaveBeenCalledWith({ action: Action.RecheckTheme, forceTheme: "dark" });
        expect(requestClose).toHaveBeenCalled();
    });

    it("rechecks theme when setting theme fails", async () => {
        mocked(SettingsStore.setValue).mockRejectedValue("oops");
        const requestClose = jest.fn();
        renderComponent({ requestClose });

        await selectFromDropdown(/match system/i);

        expect(dis.dispatch).toHaveBeenCalledWith({ action: Action.RecheckTheme });
        expect(requestClose).toHaveBeenCalled();
    });
});
