/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { render } from "@testing-library/react";
import React from "react";

import ExternalLink from "../../../../src/components/views/elements/ExternalLink";

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
