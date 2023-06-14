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

import { act, fireEvent, render } from "@testing-library/react";
import React from "react";

import { FilterDropdown } from "../../../../src/components/views/elements/FilterDropdown";
import { flushPromises, mockPlatformPeg } from "../../../test-utils";

mockPlatformPeg();

describe("<FilterDropdown />", () => {
    const options = [
        { id: "one", label: "Option one" },
        { id: "two", label: "Option two", description: "with description" },
    ];
    const defaultProps = {
        className: "test",
        value: "one",
        options,
        id: "test",
        label: "test label",
        onOptionChange: jest.fn(),
    };
    const getComponent = (props = {}): JSX.Element => <FilterDropdown {...defaultProps} {...props} />;

    const openDropdown = async (container: HTMLElement): Promise<void> =>
        await act(async () => {
            const button = container.querySelector('[role="button"]');
            expect(button).toBeTruthy();
            fireEvent.click(button as Element);
            await flushPromises();
        });

    it("renders selected option", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders when selected option is not in options", () => {
        const { container } = render(getComponent({ value: "oops" }));
        expect(container).toMatchSnapshot();
    });

    it("renders selected option with selectedLabel", () => {
        const { container } = render(getComponent({ selectedLabel: "Show" }));
        expect(container).toMatchSnapshot();
    });

    it("renders dropdown options in menu", async () => {
        const { container } = render(getComponent());
        await openDropdown(container);
        expect(container.querySelector(".mx_Dropdown_menu")).toMatchSnapshot();
    });
});
