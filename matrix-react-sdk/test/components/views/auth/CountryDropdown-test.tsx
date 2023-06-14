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
import { render } from "@testing-library/react";

import CountryDropdown from "../../../../src/components/views/auth/CountryDropdown";
import SdkConfig from "../../../../src/SdkConfig";

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
});
