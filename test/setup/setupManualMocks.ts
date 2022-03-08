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

import { TextDecoder, TextEncoder } from "util";

// jest 27 removes setImmediate from jsdom
// polyfill until setImmediate use in client can be removed
// @ts-ignore - we know the contract is wrong. That's why we're stubbing it.
global.setImmediate = callback => setTimeout(callback, 0);

// Stub ResizeObserver
// @ts-ignore - we know it's a duplicate (that's why we're stubbing it)
class ResizeObserver {
    observe() {} // do nothing
    unobserve() {} // do nothing
    disconnect() {} // do nothing
}
window.ResizeObserver = ResizeObserver;

// matchMedia is not included in jsdom
const mockMatchMedia = jest.fn().mockImplementation(query => ({
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

// polyfilling TextEncoder as it is not available on JSDOM
// view https://github.com/facebook/jest/issues/9983
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// prevent errors whenever a component tries to manually scroll.
window.HTMLElement.prototype.scrollIntoView = jest.fn();
