/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SettingsStore from "../../../src/settings/SettingsStore";
import { getScrollBehavior, prefersReducedMotion, smoothScrollingDisabled } from "../../../src/utils/scrollBehavior";

jest.mock("../../../src/settings/SettingsStore");

describe("scrollBehavior", () => {
    const mockedGetValue = jest.mocked(SettingsStore.getValue);

    /** Set up matchMedia so that (prefers-reduced-motion: reduce) returns `matches`. */
    const mockMatchMedia = (matches: boolean): void => {
        globalThis.matchMedia = jest.fn().mockReturnValue({ matches }) as unknown as typeof globalThis.matchMedia;
    };

    beforeEach(() => {
        jest.resetAllMocks();
        mockedGetValue.mockReturnValue(false);
        mockMatchMedia(false);
    });

    describe("prefersReducedMotion", () => {
        it("returns true when the OS prefers reduced motion", () => {
            mockMatchMedia(true);
            expect(prefersReducedMotion()).toBe(true);
        });

        it("returns false when the OS does not prefer reduced motion", () => {
            mockMatchMedia(false);
            expect(prefersReducedMotion()).toBe(false);
        });

        it("returns false (and does not throw) when matchMedia is undefined", () => {
            // @ts-ignore deliberately removing matchMedia to emulate an environment without it
            delete globalThis.matchMedia;
            expect(() => prefersReducedMotion()).not.toThrow();
            expect(prefersReducedMotion()).toBe(false);
        });
    });

    describe("smoothScrollingDisabled", () => {
        it.each([
            { setting: false, reduce: false, expected: false },
            { setting: true, reduce: false, expected: true },
            { setting: false, reduce: true, expected: true },
            { setting: true, reduce: true, expected: true },
        ])(
            "is the OR of the setting ($setting) and OS reduced-motion ($reduce) => $expected",
            ({ setting, reduce, expected }) => {
                mockedGetValue.mockReturnValue(setting);
                mockMatchMedia(reduce);
                expect(smoothScrollingDisabled()).toBe(expected);
            },
        );

        it("reads the Accessibility.disableSmoothScrolling setting", () => {
            mockedGetValue.mockReturnValue(false);
            smoothScrollingDisabled();
            expect(mockedGetValue).toHaveBeenCalledWith("Accessibility.disableSmoothScrolling");
        });
    });

    describe("getScrollBehavior", () => {
        it("returns 'smooth' when the setting is off and the OS does not prefer reduced motion", () => {
            mockedGetValue.mockReturnValue(false);
            mockMatchMedia(false);
            expect(getScrollBehavior()).toBe("smooth");
        });

        it("returns 'auto' when the user has disabled smooth scrolling (OS query off)", () => {
            mockedGetValue.mockReturnValue(true);
            mockMatchMedia(false);
            expect(getScrollBehavior()).toBe("auto");
        });

        it("returns 'auto' when the OS prefers reduced motion (setting off)", () => {
            mockedGetValue.mockReturnValue(false);
            mockMatchMedia(true);
            expect(getScrollBehavior()).toBe("auto");
        });

        it("honours a custom preferred behavior when smooth scrolling is enabled", () => {
            mockedGetValue.mockReturnValue(false);
            mockMatchMedia(false);
            expect(getScrollBehavior("instant")).toBe("instant");
        });
    });
});
