/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "test-utils-rtl";

import { Caption } from "./Caption";

describe("<Caption />", () => {
    const defaultProps = {
        "children": "test",
        "data-testid": "test test id",
    };
    const getComponent = (props = {}) => <Caption {...defaultProps} {...props} />;

    it("renders plain text children", () => {
        const { container } = render(getComponent());
        expect({ container }).toMatchSnapshot();
    });

    it("renders an error message", () => {
        const { container } = render(getComponent({ isError: true }));
        expect({ container }).toMatchSnapshot();
    });

    it("renders react children", () => {
        const children = (
            <>
                Test <b>test but bold</b>
            </>
        );
        const { container } = render(getComponent({ children }));
        expect({ container }).toMatchSnapshot();
    });
});
