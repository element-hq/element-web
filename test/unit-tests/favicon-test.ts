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
