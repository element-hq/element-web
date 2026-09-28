/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "test-utils-rtl";

import { SettingsHeader } from "./SettingsHeader";

describe("<SettingsHeader />", () => {
    it("should render the component", () => {
        const { asFragment } = render(<SettingsHeader label="Settings Header" />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render the component with the recommended tag", () => {
        const { asFragment } = render(<SettingsHeader label="Settings Header" hasRecommendedTag={true} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
