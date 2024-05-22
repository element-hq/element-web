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
