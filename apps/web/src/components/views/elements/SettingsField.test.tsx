/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import SettingsField from "./SettingsField";
import { SettingLevel } from "../../../settings/SettingLevel";

describe("<SettingsField />", () => {
    it("should render with the default label", () => {
        const component = render(<SettingsField settingKey="Developer.elementCallUrl" level={SettingLevel.DEVICE} />);

        expect(screen.getByText("Element Call URL")).toBeTruthy();
        expect(component.asFragment()).toMatchSnapshot();
    });

    it("should call onChange when saving a change", async () => {
        const fn = vi.fn();
        render(<SettingsField settingKey="Developer.elementCallUrl" level={SettingLevel.DEVICE} onChange={fn} />);

        const input = screen.getByRole("textbox");
        await userEvent.type(input, "https://call.element.dev");
        expect(input).toHaveValue("https://call.element.dev");

        screen.getByLabelText("Save").click();
        await waitFor(() => {
            expect(fn).toHaveBeenCalledWith("https://call.element.dev");
        });
    });
});
