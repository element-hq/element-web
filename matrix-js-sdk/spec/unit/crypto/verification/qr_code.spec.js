/*
Copyright 2018-2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import "../../../olm-loader";
import { logger } from "../../../../src/logger";

const Olm = global.Olm;

describe("QR code verification", function() {
    if (!global.Olm) {
        logger.warn('Not running device verification tests: libolm not present');
        return;
    }

    beforeAll(function() {
        return Olm.init();
    });

    describe("reciprocate", () => {
        it("should verify the secret", () => {
            // TODO: Actually write a test for this.
            // Tests are hard because we are running before the verification
            // process actually begins, and are largely UI-driven rather than
            // logic-driven (compared to something like SAS). In the interest
            // of time, tests are currently excluded.
        });
    });
});
