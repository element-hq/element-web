/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi } from "vitest";

const RealDateTimeFormat = globalThis.Intl.DateTimeFormat;

// Under vitest's worker-threads pool, `Intl.DateTimeFormat`'s *default* (unspecified) timeZone is
// baked in at worker creation from the real OS timezone and can never be changed at runtime via
// `process.env.TZ`/`vi.stubEnv` (a Node/V8 worker-thread limitation) — unlike Jest, which runs each
// test file in a genuinely separate process that picks up `TZ=UTC` fresh at startup. Date formatting
// defaults to the user's timezone when no explicit zone is supplied. Force the expected timezone
// through this helper so tests don't depend on the machine's real local timezone.
// allow setting default locale and set timezone
// defaults to en-GB / UTC
// so tests run the same everywhere
export const mockIntlDateTimeFormat = (): void => {
    vi.spyOn(globalThis.Intl, "DateTimeFormat").mockImplementation(function (locale, options) {
        return new RealDateTimeFormat(locale || "en-GB", { ...options, timeZone: "UTC" });
    });
};

export const unmockIntlDateTimeFormat = (): void => {
    vi.spyOn(globalThis.Intl, "DateTimeFormat").mockRestore();
};
