/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import "@testing-library/jest-dom";
import "blob-polyfill";
import { randomString } from "matrix-js-sdk/src/randomstring";
import { mocked } from "jest-mock";

import { PredictableRandom } from "./predictableRandom"; // https://github.com/jsdom/jsdom/issues/2555

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring");
beforeEach(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const mockRandom = new PredictableRandom();
    mocked(randomString).mockImplementation((len) => {
        let ret = "";
        for (let i = 0; i < len; ++i) {
            const v = mockRandom.get() * chars.length;
            const m = ((v % chars.length) + chars.length) % chars.length; // account for negative modulo
            ret += chars.charAt(Math.floor(m));
        }
        return ret;
    });
});

// Very carefully enable the mocks for everything else in
// a specific order. We use this order to ensure we properly
// establish an application state that actually works.
//
// These are also require() calls to make sure they get called
// synchronously.
require("./setup/setupManualMocks"); // must be first
require("./setup/setupLanguage");
require("./setup/setupConfig");
