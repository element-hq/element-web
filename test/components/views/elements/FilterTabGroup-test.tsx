/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { fireEvent, render } from "@testing-library/react";

import { FilterTabGroup } from "../../../../src/components/views/elements/FilterTabGroup";

describe("<FilterTabGroup />", () => {
    enum TestOption {
        Apple = "Apple",
        Banana = "Banana",
        Orange = "Orange",
    }
    const defaultProps = {
        "name": "test",
        "value": TestOption.Apple,
        "onFilterChange": jest.fn(),
        "tabs": [
            { id: TestOption.Apple, label: `Label for ${TestOption.Apple}` },
            { id: TestOption.Banana, label: `Label for ${TestOption.Banana}` },
            { id: TestOption.Orange, label: `Label for ${TestOption.Orange}` },
        ],
        "data-testid": "test",
    };
    const getComponent = (props = {}) => <FilterTabGroup<TestOption> {...defaultProps} {...props} />;

    it("renders options", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("calls onChange handler on selection", () => {
        const onFilterChange = jest.fn();
        const { getByText } = render(getComponent({ onFilterChange }));

        fireEvent.click(getByText("Label for Banana"));

        expect(onFilterChange).toHaveBeenCalledWith(TestOption.Banana);
    });
});
