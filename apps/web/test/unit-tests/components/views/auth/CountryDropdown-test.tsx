/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import CountryDropdown from "../../../../../src/components/views/auth/CountryDropdown";
import SdkConfig from "../../../../../src/SdkConfig";

describe("CountryDropdown", () => {
    describe("default_country_code", () => {
        afterEach(() => {
            SdkConfig.reset();
        });

        it.each([
            ["GB", 44],
            ["IE", 353],
            ["ES", 34],
            ["FR", 33],
            ["PL", 48],
            ["DE", 49],
        ])("should respect configured default country code for %s", (config, defaultCountryCode) => {
            SdkConfig.add({
                default_country_code: config,
            });

            const fn = jest.fn();
            render(<CountryDropdown onOptionChange={fn} isSmall={false} showPrefix={false} />);
            expect(fn).toHaveBeenCalledWith(expect.objectContaining({ prefix: defaultCountryCode.toString() }));
        });
    });

    describe("defaultCountry", () => {
        it.each([
            ["en-GB", 44],
            ["en-ie", 353],
            ["es-ES", 34],
            ["fr", 33],
            ["pl", 48],
            ["de-DE", 49],
        ])("should pick appropriate default country for %s", (language, defaultCountryCode) => {
            Object.defineProperty(navigator, "language", {
                configurable: true,
                get() {
                    return language;
                },
            });

            const fn = jest.fn();
            render(<CountryDropdown onOptionChange={fn} isSmall={false} showPrefix={false} />);
            expect(fn).toHaveBeenCalledWith(expect.objectContaining({ prefix: defaultCountryCode.toString() }));
        });
    });

    it("should allow filtering", async () => {
        const fn = jest.fn();
        const { getByRole, findByText } = render(
            <CountryDropdown onOptionChange={fn} isSmall={false} showPrefix={false} />,
        );

        const dropdown = getByRole("button");
        fireEvent.click(dropdown);

        await userEvent.keyboard("Al");

        await expect(findByText("Albania (+355)")).resolves.toBeInTheDocument();
    });
});
