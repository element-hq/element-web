/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { SettingLevel } from "../../../../../src/settings/SettingLevel.ts";
import SettingsDropdown from "../../../../../src/components/views/elements/SettingsDropdown.tsx";

describe("<SettingsDropdown />", () => {
    it("should render a disabled setting", async () => {
        const { asFragment } = render(
            <SettingsDropdown settingKey="Electron.autoLaunch" level={SettingLevel.PLATFORM} />,
        );
        expect(asFragment()).toMatchSnapshot();

        const trigger = screen.getByRole("button");
        expect(trigger).toHaveTextContent("No");
        expect(trigger).toHaveAttribute("aria-disabled", "true");
    });

    it("should not render a disabled setting if hideIfCannotSet=true", async () => {
        const { container } = render(
            <SettingsDropdown settingKey="Electron.autoLaunch" level={SettingLevel.PLATFORM} hideIfCannotSet />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("should not render a non-options setting", async () => {
        const { container } = render(<SettingsDropdown settingKey="systemFont" level={SettingLevel.DEVICE} />);
        expect(container).toBeEmptyDOMElement();
    });
});
