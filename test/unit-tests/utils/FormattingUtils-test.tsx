/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { formatList, formatCount, formatCountLong } from "../../../src/utils/FormattingUtils";
import SettingsStore from "../../../src/settings/SettingsStore";

jest.mock("../../../src/dispatcher/dispatcher");

describe("FormattingUtils", () => {
    describe("formatCount", () => {
        it.each([
            { count: 999, expectedCount: "999" },
            { count: 9999, expectedCount: "10K" },
            { count: 99999, expectedCount: "100K" },
            { count: 999999, expectedCount: "1M" },
            { count: 9999999, expectedCount: "10M" },
            { count: 99999999, expectedCount: "100M" },
            { count: 999999999, expectedCount: "1B" },
            { count: 9999999999, expectedCount: "10B" },
        ])("formats $count as $expectedCount", ({ count, expectedCount }) => {
            expect(formatCount(count)).toBe(expectedCount);
        });
    });

    describe("formatCountLong", () => {
        it("formats numbers according to the locale", () => {
            expect(formatCountLong(1000)).toBe("1,000");
        });
    });

    describe("formatList", () => {
        beforeEach(() => {
            jest.resetAllMocks();
            jest.spyOn(SettingsStore, "getValue").mockReturnValue("en-GB");
        });

        it("should return empty string when given empty list", () => {
            expect(formatList([])).toEqual("");
        });

        it("should return only item when given list of length 1", () => {
            expect(formatList(["abc"])).toEqual("abc");
        });

        it("should return expected sentence in English without item limit", () => {
            expect(formatList(["abc", "def", "ghi"])).toEqual("abc, def and ghi");
        });

        it("should return expected sentence in German without item limit", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue("de");
            expect(formatList(["abc", "def", "ghi"])).toEqual("abc, def und ghi");
        });

        it("should return expected sentence in English with item limit", () => {
            expect(formatList(["abc", "def", "ghi", "jkl"], 2)).toEqual("abc, def and 2 others");
            expect(formatList(["abc", "def", "ghi", "jkl"], 3)).toEqual("abc, def, ghi and one other");
        });

        it("should return expected sentence in English with item limit and includeCount", () => {
            expect(formatList(["abc", "def", "ghi", "jkl"], 3, true)).toEqual("abc, def and 2 others");
            expect(formatList(["abc", "def", "ghi", "jkl"], 4, true)).toEqual("abc, def, ghi and jkl");
        });

        it("should return expected sentence in ReactNode when given 2 React children", () => {
            expect(formatList([<span key="a">a</span>, <span key="b">b</span>])).toMatchSnapshot();
        });

        it("should return expected sentence in ReactNode when given more React children", () => {
            expect(
                formatList([
                    <span key="a">a</span>,
                    <span key="b">b</span>,
                    <span key="c">c</span>,
                    <span key="d">d</span>,
                ]),
            ).toMatchSnapshot();
        });

        it("should return expected sentence in ReactNode when using itemLimit", () => {
            expect(
                formatList(
                    [<span key="a">a</span>, <span key="b">b</span>, <span key="c">c</span>, <span key="d">d</span>],
                    2,
                ),
            ).toMatchSnapshot();
        });
    });
});
