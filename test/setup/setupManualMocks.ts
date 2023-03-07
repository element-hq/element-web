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

import fetchMock from "fetch-mock-jest";
import { TextDecoder, TextEncoder } from "util";
import { Response } from "node-fetch";

// jest 27 removes setImmediate from jsdom
// polyfill until setImmediate use in client can be removed
// @ts-ignore - we know the contract is wrong. That's why we're stubbing it.
global.setImmediate = (callback) => window.setTimeout(callback, 0);

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
const mockMatchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
}));
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

// set up fetch API mock
fetchMock.config.overwriteRoutes = false;
fetchMock.catch("");
fetchMock.get("/image-file-stub", "image file stub");
fetchMock.get("/_matrix/client/versions", {});
// @ts-ignore
window.fetch = fetchMock.sandbox();

// @ts-ignore
window.Response = Response;

// set up mediaDevices mock
Object.defineProperty(navigator, "mediaDevices", {
    value: {
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn(),
    },
});
