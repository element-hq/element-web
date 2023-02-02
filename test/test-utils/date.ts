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

export const REPEATABLE_DATE = new Date(2022, 10, 17, 16, 58, 32, 517);

// allow setting default locale and set timezone
// defaults to en-GB / Europe/London
// so tests run the same everywhere
export const mockIntlDateTimeFormat = (defaultLocale = "en-GB", defaultTimezone = "Europe/London"): void => {
    // unmock so we can use real DateTimeFormat in mockImplementation
    if (jest.isMockFunction(global.Intl.DateTimeFormat)) {
        unmockIntlDateTimeFormat();
    }
    const DateTimeFormat = Intl.DateTimeFormat;
    jest.spyOn(global.Intl, "DateTimeFormat").mockImplementation(
        (locale, options) => new DateTimeFormat(locale || defaultLocale, { ...options, timeZone: defaultTimezone }),
    );
};

export const unmockIntlDateTimeFormat = (): void => {
    jest.spyOn(global.Intl, "DateTimeFormat").mockRestore();
};
