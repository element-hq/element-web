/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import Heading from "../../../../../src/components/views/typography/Heading";
describe("<Heading />", () => {
    const defaultProps = {
        "size": "1",
        "children": <div>test</div>,
        "data-testid": "test",
        "className": "test",
    } as any;
    const getComponent = (props = {}) => {
        return render(<Heading {...defaultProps} {...props} />);
    };

    it("renders h1 with correct attributes", () => {
        expect(getComponent({ size: "1" }).asFragment()).toMatchSnapshot();
    });
    it("renders h2 with correct attributes", () => {
        expect(getComponent({ size: "2" }).asFragment()).toMatchSnapshot();
    });
    it("renders h3 with correct attributes", () => {
        expect(getComponent({ size: "3" }).asFragment()).toMatchSnapshot();
    });

    it("renders h4 with correct attributes", () => {
        expect(getComponent({ size: "4" }).asFragment()).toMatchSnapshot();
    });

    it("can have different appearance to its heading level", () => {
        expect(getComponent({ size: "4", as: "h1" }).asFragment()).toMatchSnapshot();
    });
});
