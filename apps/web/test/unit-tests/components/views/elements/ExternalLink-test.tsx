/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import ExternalLink from "../../../../../src/components/views/elements/ExternalLink";

describe("<ExternalLink />", () => {
    const defaultProps = {
        "href": "test.com",
        "onClick": jest.fn(),
        "className": "myCustomClass",
        "data-testid": "test",
    };
    const getComponent = (props = {}) => {
        return render(<ExternalLink {...defaultProps} {...props} />);
    };

    it("renders link correctly", () => {
        const children = (
            <span>
                react element <b>children</b>
            </span>
        );
        expect(getComponent({ children, target: "_self", rel: "noopener" }).asFragment()).toMatchSnapshot();
    });

    it("defaults target and rel", () => {
        const children = "test";
        const { getByTestId } = getComponent({ children });
        const container = getByTestId("test");
        expect(container.getAttribute("rel")).toEqual("noreferrer noopener");
        expect(container.getAttribute("target")).toEqual("_blank");
    });

    it("renders plain text link correctly", () => {
        const children = "test";
        expect(getComponent({ children }).asFragment()).toMatchSnapshot();
    });
});
