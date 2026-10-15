/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "test-utils-rtl";

import SettingsFieldset from "./SettingsFieldset";

describe("<SettingsFieldset />", () => {
    const defaultProps = {
        "legend": "Who can read history?",
        "children": <div>test</div>,
        "data-testid": "test",
    };
    const getComponent = (props = {}) => {
        return render(<SettingsFieldset {...defaultProps} {...props} />);
    };

    it("renders fieldset without description", () => {
        expect(getComponent().asFragment()).toMatchSnapshot();
    });

    it("renders fieldset with plain text description", () => {
        const description = "Changes to who can read history.";
        expect(getComponent({ description }).asFragment()).toMatchSnapshot();
    });

    it("renders fieldset with react description", () => {
        const description = (
            <>
                <p>Test</p>
                <a href="#test">a link</a>
            </>
        );
        expect(getComponent({ description }).asFragment()).toMatchSnapshot();
    });
});
