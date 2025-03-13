/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import { TextDecoder, TextEncoder } from "util";
import { Response } from "node-fetch";

import { mocks } from "./mocks";

// Stub ResizeObserver
// @ts-ignore - we know it's a duplicate (that's why we're stubbing it)
class ResizeObserver {
    observe() {} // do nothing
    unobserve() {} // do nothing
    disconnect() {} // do nothing
}
window.ResizeObserver = ResizeObserver;

// Stub DOMRect
class DOMRect {
    x = 0;
    y = 0;
    top = 0;
    bottom = 0;
    left = 0;
    right = 0;
    height = 0;
    width = 0;

    static fromRect() {
        return new DOMRect();
    }
    toJSON() {}
}

window.DOMRect = DOMRect;

// Work around missing ClipboardEvent type
class MyClipboardEvent extends Event {}
window.ClipboardEvent = MyClipboardEvent as any;

// matchMedia is not included in jsdom
// TODO: Extract this to a function and have tests that need it opt into it.
const mockMatchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
});
global.matchMedia = mockMatchMedia;

// maplibre requires a createObjectURL mock
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// polyfilling TextEncoder as it is not available on JSDOM
// view https://github.com/facebook/jest/issues/9983
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

// prevent errors whenever a component tries to manually scroll.
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLAudioElement.prototype.canPlayType = jest.fn((format) => (format === "audio/mpeg" ? "probably" : ""));

// set up fetch API mock
fetchMock.config.overwriteRoutes = false;
fetchMock.catch("");
fetchMock.get("/image-file-stub", "image file stub");
fetchMock.get("/_matrix/client/versions", {});
// @ts-ignore
window.fetch = fetchMock.sandbox();

// @ts-ignore
window.Response = Response;

// set up AudioContext API mock
global.AudioContext = jest.fn().mockImplementation(() => ({ ...mocks.AudioContext }));
