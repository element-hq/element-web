/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render } from "@testing-library/react";

import { Caption } from "../../../../src/components/views/typography/Caption";

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
