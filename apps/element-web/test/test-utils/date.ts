/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export const REPEATABLE_DATE = new Date(2022, 10, 17, 16, 58, 32, 517);

const RealDateTimeFormat = global.Intl.DateTimeFormat;

// allow setting default locale and set timezone
// defaults to en-GB / Europe/London
// so tests run the same everywhere
export const mockIntlDateTimeFormat = (defaultLocale = "en-GB", defaultTimezone = "Europe/London"): void => {
    jest.spyOn(global.Intl, "DateTimeFormat").mockImplementation(
        (locale, options) => new RealDateTimeFormat(locale || defaultLocale, { ...options, timeZone: defaultTimezone }),
    );
};

export const unmockIntlDateTimeFormat = (): void => {
    jest.spyOn(global.Intl, "DateTimeFormat").mockRestore();
};
