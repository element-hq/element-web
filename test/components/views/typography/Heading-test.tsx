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

import { render } from "@testing-library/react";
import React from "react";

import Heading from "../../../../src/components/views/typography/Heading";
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
