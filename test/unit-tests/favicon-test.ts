/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "jest-canvas-mock";

import Favicon from "../../src/favicon";

jest.useFakeTimers();

describe("Favicon", () => {
    beforeEach(() => {
        const head = document.createElement("head");
        window.document.documentElement.prepend(head);
    });

    it("should create a link element if one doesn't yet exist", () => {
        const favicon = new Favicon();
        expect(favicon).toBeTruthy();
        const link = window.document.querySelector("link")!;
        expect(link.rel).toContain("icon");
    });

    it("should draw a badge if called with a non-zero value", () => {
        const favicon = new Favicon();
        favicon.badge(123);
        jest.runAllTimers();
        expect(favicon["context"].__getDrawCalls()).toMatchSnapshot();
    });

    it("should clear a badge if called with a zero value", () => {
        const favicon = new Favicon();
        favicon.badge(123);
        jest.runAllTimers();
        favicon.badge(0);
        expect(favicon["context"].__getDrawCalls()).toMatchSnapshot();
    });

    it("should recreate link element for firefox and opera", () => {
        window["InstallTrigger"] = {};
        window["opera"] = {};
        const favicon = new Favicon();
        const originalLink = window.document.querySelector("link");
        favicon.badge(123);
        jest.runAllTimers();
        const newLink = window.document.querySelector("link");
        expect(originalLink).not.toStrictEqual(newLink);
    });
});
