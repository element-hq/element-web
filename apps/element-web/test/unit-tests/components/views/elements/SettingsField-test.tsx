/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import SettingsField from "../../../../../src/components/views/elements/SettingsField";
import { SettingLevel } from "../../../../../src/settings/SettingLevel.ts";

describe("<SettingsField />", () => {
    it("should render with the default label", () => {
        const component = render(<SettingsField settingKey="Developer.elementCallUrl" level={SettingLevel.DEVICE} />);

        expect(screen.getByText("Element Call URL")).toBeTruthy();
        expect(component.asFragment()).toMatchSnapshot();
    });

    it("should call onChange when saving a change", async () => {
        const fn = jest.fn();
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
