/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { shouldRedirectToMobileGuide, type MobileGuideRedirectOptions } from "./shouldRedirectToMobileGuide";
import { parseAppUrl } from "../url_utils";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0";

const appUrl = (fragment = ""): ReturnType<typeof parseAppUrl> =>
    parseAppUrl(new URL(`https://element.example.com/${fragment}`));

const options = (overrides: Partial<MobileGuideRedirectOptions> = {}): MobileGuideRedirectOptions => ({
    userAgent: IPHONE,
    hasMSStream: false,
    parsedUrl: appUrl(),
    hasSkippedRedirect: false,
    ...overrides,
});

describe("shouldRedirectToMobileGuide", () => {
    it("redirects a mobile browser when the option is unset", () => {
        expect(shouldRedirectToMobileGuide(options())).toBe(true);
        expect(shouldRedirectToMobileGuide(options({ userAgent: ANDROID }))).toBe(true);
    });

    it("redirects a mobile browser when the option is explicitly true", () => {
        expect(shouldRedirectToMobileGuide(options({ mobileGuideToast: true }))).toBe(true);
    });

    it("does not redirect when the option is false", () => {
        expect(shouldRedirectToMobileGuide(options({ mobileGuideToast: false }))).toBe(false);
        expect(shouldRedirectToMobileGuide(options({ userAgent: ANDROID, mobileGuideToast: false }))).toBe(false);
    });

    it("does not redirect a desktop browser", () => {
        expect(shouldRedirectToMobileGuide(options({ userAgent: DESKTOP }))).toBe(false);
    });

    it("does not redirect Internet Explorer on Windows Phone", () => {
        expect(shouldRedirectToMobileGuide(options({ hasMSStream: true }))).toBe(false);
    });

    it("does not redirect a 3pid verification", () => {
        const parsedUrl = appUrl("#?client_secret=abc&sid=1");
        expect(parsedUrl.params.threepid).toEqual({ client_secret: "abc", sid: "1" });
        expect(shouldRedirectToMobileGuide(options({ parsedUrl }))).toBe(false);
    });

    it("does not redirect a deep link", () => {
        const parsedUrl = appUrl("#/room/!abc:example.com");
        expect(parsedUrl.location).toBe("/room/!abc:example.com");
        expect(shouldRedirectToMobileGuide(options({ parsedUrl }))).toBe(false);
    });

    it("does not redirect once the user has chosen to stay in the browser", () => {
        expect(shouldRedirectToMobileGuide(options({ hasSkippedRedirect: true }))).toBe(false);
    });
});
