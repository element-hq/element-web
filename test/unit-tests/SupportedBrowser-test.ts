/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { checkBrowserSupport, LOCAL_STORAGE_KEY } from "../../src/SupportedBrowser";
import ToastStore from "../../src/stores/ToastStore";
import GenericToast from "../../src/components/views/toasts/GenericToast";

jest.mock("matrix-js-sdk/src/logger");

describe("SupportedBrowser", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        localStorage.clear();
    });

    const testUserAgentFactory =
        (expectedWarning?: string) =>
        async (userAgent: string): Promise<void> => {
            const toastSpy = jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
            const warnLogSpy = jest.spyOn(logger, "warn");
            Object.defineProperty(window, "navigator", { value: { userAgent: userAgent }, writable: true });
            checkBrowserSupport();
            if (expectedWarning) {
                expect(warnLogSpy).toHaveBeenCalledWith(expectedWarning, expect.any(String));
                expect(toastSpy).toHaveBeenCalled();
            } else {
                expect(warnLogSpy).not.toHaveBeenCalled();
                expect(toastSpy).not.toHaveBeenCalled();
            }
        };

    it.each([
        // Safari on iOS
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        // Firefox on iOS
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/128.0 Mobile/15E148 Safari/605.1.15",
        // Opera on Samsung
        "Mozilla/5.0 (Linux; Android 10; SM-G970F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.64 Mobile Safari/537.36 OPR/76.2.4027.73374",
    ])("should warn for mobile browsers", testUserAgentFactory("Browser unsupported, unsupported device type"));

    it.each([
        // Chrome on Chrome OS
        "Mozilla/5.0 (X11; CrOS x86_64 15633.69.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.212 Safari/537.36",
        // Opera on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 OPR/113.0.0.0",
        // Vivaldi on Linux
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Vivaldi/6.8.3381.48",
        // IE11 on Windows 10
        "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
        // Firefox 115 on macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_4_5; rv:115.0) Gecko/20000101 Firefox/115.0",
    ])(
        "should warn for unsupported desktop browsers",
        testUserAgentFactory("Browser unsupported, unsupported user agent"),
    );

    // Grabbed from https://www.whatismybrowser.com/guides/the-latest-user-agent/
    it.each([
        // Safari 18.0 on macOS Sonoma
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        // Latest Firefox on macOS Sonoma
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0",
        // Edge 131 on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70",
        // Edge 131 on macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70",
        // Latest Firefox on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        // Latest Firefox on Linux
        "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
        // Latest Chrome on Windows
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ])("should not warn for supported browsers", testUserAgentFactory());

    it.each([
        // Element Nightly on macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ElementNightly/2024072501 Chrome/126.0.6478.127 Electron/31.2.1 Safari/537.36",
    ])("should not warn for Element Desktop", testUserAgentFactory());

    it.each(["AppleTV11,1/11.1"])(
        "should handle unknown user agent sanely",
        testUserAgentFactory("Browser unsupported, unknown client"),
    );

    it("should not warn for unsupported browser if user accepted already", async () => {
        const toastSpy = jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
        const warnLogSpy = jest.spyOn(logger, "warn");
        const userAgent =
            "Mozilla/5.0 (X11; CrOS x86_64 15633.69.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.212 Safari/537.36";
        Object.defineProperty(window, "navigator", { value: { userAgent: userAgent }, writable: true });

        checkBrowserSupport();
        expect(warnLogSpy).toHaveBeenCalledWith("Browser unsupported, unsupported user agent", expect.any(String));
        expect(toastSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                component: GenericToast,
                title: "Element does not support this browser",
            }),
        );

        localStorage.setItem(LOCAL_STORAGE_KEY, String(true));
        toastSpy.mockClear();
        warnLogSpy.mockClear();

        checkBrowserSupport();
        expect(warnLogSpy).toHaveBeenCalledWith("Browser unsupported, but user has previously accepted");
        expect(toastSpy).not.toHaveBeenCalled();
    });
});
