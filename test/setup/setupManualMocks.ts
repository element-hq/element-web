/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock, { manageFetchMockGlobally } from "@fetch-mock/jest";
import { jest } from "@jest/globals";

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
global.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn<(event: Event) => boolean>(),
});

// maplibre requires a createObjectURL mock
global.URL.createObjectURL = jest.fn((obj) => "blob");
global.URL.revokeObjectURL = jest.fn();

// prevent errors whenever a component tries to manually scroll.
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLAudioElement.prototype.canPlayType = jest.fn((format) => (format === "audio/mpeg" ? "probably" : ""));

function setupFileStubMocks() {
    fetchMock.get("end:/image-file-stub", "image file stub", { sticky: true });
}
setupFileStubMocks();

beforeEach(() => {
    window.sessionStorage?.clear();
    window.localStorage?.clear();

    // set up fetch API mock
    fetchMock.hardReset();
    fetchMock.catch(404);
    setupFileStubMocks();
    fetchMock.get("/_matrix/client/versions", {}, { sticky: true });
    fetchMock.mockGlobal();
});

afterEach(() => {
    fetchMock.removeRoutes();
});

fetchMock.config.allowRelativeUrls = true;
manageFetchMockGlobally(jest);

// set up AudioContext API mock
global.AudioContext = jest.fn<() => AudioContext>().mockImplementation(() => ({ ...mocks.AudioContext }));
