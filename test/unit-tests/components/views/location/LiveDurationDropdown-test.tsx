/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import LiveDurationDropdown, {
    DEFAULT_DURATION_MS,
} from "../../../../../src/components/views/location/LiveDurationDropdown";
import { mockPlatformPeg } from "../../../../test-utils";

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
