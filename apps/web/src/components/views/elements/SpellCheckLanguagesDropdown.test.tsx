/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitForElementToBeRemoved } from "test-utils-rtl";

import SpellCheckLanguagesDropdown from "./SpellCheckLanguagesDropdown";
import PlatformPeg from "../../../PlatformPeg";

describe("<SpellCheckLanguagesDropdown />", () => {
    it("renders as expected", async () => {
        const platform: any = {
            getAvailableSpellCheckLanguages: vi.fn().mockResolvedValue(["en", "de", "qq"]),
            supportsSetting: vi.fn(),
        };
        PlatformPeg.set(platform);

        const { asFragment } = render(
            <SpellCheckLanguagesDropdown
                className="mx_GeneralUserSettingsTab_spellCheckLanguageInput"
                value="en"
                onOptionChange={vi.fn()}
            />,
        );
        await waitForElementToBeRemoved(() => screen.queryAllByLabelText("Loading…"));
        expect(asFragment()).toMatchSnapshot();
    });
});
