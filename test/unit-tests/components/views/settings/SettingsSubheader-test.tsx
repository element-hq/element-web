/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";

import { SettingsSubheader } from "../../../../../src/components/views/settings/SettingsSubheader";

describe("<SettingsSubheader />", () => {
    it("should display a check icon when in success", () => {
        const { asFragment } = render(<SettingsSubheader state="success" stateMessage="Success!" />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display an error icon when in error", () => {
        const { asFragment } = render(<SettingsSubheader state="error" stateMessage="Error!" />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display a label", () => {
        const { asFragment } = render(<SettingsSubheader label="My label" state="success" stateMessage="Success!" />);
        expect(asFragment()).toMatchSnapshot();
    });
});
