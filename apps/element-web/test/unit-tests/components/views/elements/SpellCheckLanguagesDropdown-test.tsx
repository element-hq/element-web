/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitForElementToBeRemoved } from "jest-matrix-react";

import SpellCheckLanguagesDropdown from "../../../../../src/components/views/elements/SpellCheckLanguagesDropdown";
import PlatformPeg from "../../../../../src/PlatformPeg";

describe("<SpellCheckLanguagesDropdown />", () => {
    it("renders as expected", async () => {
        const platform: any = {
            getAvailableSpellCheckLanguages: jest.fn().mockResolvedValue(["en", "de", "qq"]),
            supportsSetting: jest.fn(),
        };
        PlatformPeg.set(platform);

        const { asFragment } = render(
            <SpellCheckLanguagesDropdown
                className="mx_GeneralUserSettingsTab_spellCheckLanguageInput"
                value="en"
                onOptionChange={jest.fn()}
            />,
        );
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));
        expect(asFragment()).toMatchSnapshot();
    });
});
