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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LiveDurationDropdown, {
    DEFAULT_DURATION_MS,
} from "../../../../src/components/views/location/LiveDurationDropdown";
import { mockPlatformPeg } from "../../../test-utils";

mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });

describe("<LiveDurationDropdown />", () => {
    const defaultProps = {
        timeout: DEFAULT_DURATION_MS,
        onChange: jest.fn(),
    };
    const renderComponent = (props = {}) => render(<LiveDurationDropdown {...defaultProps} {...props} />);

    const getOption = (duration: string) => screen.getByRole("option", { name: `Share for ${duration}` });
    const getSelectedOption = (duration: string) => screen.getByRole("button", { name: `Share for ${duration}` });
    const openDropdown = async () => {
        await userEvent.click(screen.getByRole("button"));
    };

    it("renders timeout as selected option", () => {
        renderComponent();
        expect(getSelectedOption("15m")).toBeInTheDocument();
    });

    it("renders non-default timeout as selected option", () => {
        const timeout = 1234567;
        renderComponent({ timeout });
        expect(getSelectedOption("21m")).toBeInTheDocument();
    });

    it("renders a dropdown option for a non-default timeout value", async () => {
        const timeout = 1234567;
        renderComponent({ timeout });
        await openDropdown();
        expect(getOption("21m")).toBeInTheDocument();
    });

    it("updates value on option selection", async () => {
        const onChange = jest.fn();
        renderComponent({ onChange });

        const ONE_HOUR = 3600000;

        await openDropdown();
        await userEvent.click(getOption("1h"));

        expect(onChange).toHaveBeenCalledWith(ONE_HOUR);
    });
});
