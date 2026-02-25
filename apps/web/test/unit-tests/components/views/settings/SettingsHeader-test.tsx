/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";

import { SettingsHeader } from "../../../../../src/components/views/settings/SettingsHeader";

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
