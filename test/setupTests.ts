/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { env } from "process";
import "@testing-library/jest-dom";
import "blob-polyfill";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { mocked } from "jest-mock";

import { PredictableRandom } from "./test-utils/predictableRandom";
import * as rageshake from "../src/rageshake/rageshake";

declare global {
    // eslint-disable-next-line no-var
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring");
beforeEach(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const mockRandom = new PredictableRandom();
    // needless to say, the mock is not cryptographically secure
    mocked(secureRandomString).mockImplementation((len) => {
        let ret = "";
        for (let i = 0; i < len; ++i) {
            const v = mockRandom.get() * chars.length;
            const m = ((v % chars.length) + chars.length) % chars.length; // account for negative modulo
            ret += chars.charAt(Math.floor(m));
        }
        return ret;
    });
});

// Somewhat hacky workaround for https://github.com/jestjs/jest/issues/15747: if the GHA reporter is enabled,
// capture logs using the rageshake infrastructure, then dump them out after the test.
if (env["GITHUB_ACTIONS"] !== undefined) {
    beforeEach(async () => {
        await rageshake.init(/* setUpPersistence = */ false);
    });

    afterEach(async () => {
        const logs = global.mx_rage_logger.flush(/* keeplogs = */ false);
        if (logs) {
            process.stderr.write(`::group::Console logs from test '${expect.getState().currentTestName}'\n\n`);
            process.stderr.write(logs);
            process.stderr.write("::endgroup::\n");
        }
    });
}

// Very carefully enable the mocks for everything else in
// a specific order. We use this order to ensure we properly
// establish an application state that actually works.
//
// These are also require() calls to make sure they get called
// synchronously.
/* eslint-disable @typescript-eslint/no-require-imports */
require("./setup/setupManualMocks"); // must be first
require("./setup/setupLanguage");
require("./setup/setupConfig");
