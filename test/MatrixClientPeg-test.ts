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

import { advanceDateAndTime, stubClient } from "./test-utils";
import { MatrixClientPeg as peg } from "../src/MatrixClientPeg";

jest.useFakeTimers();

describe("MatrixClientPeg", () => {
    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it("setJustRegisteredUserId", () => {
        stubClient();
        (peg as any).matrixClient = peg.get();
        peg.setJustRegisteredUserId("@userId:matrix.org");
        expect(peg.get().credentials.userId).toBe("@userId:matrix.org");
        expect(peg.currentUserIsJustRegistered()).toBe(true);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(true);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(true);
        advanceDateAndTime(1 * 60 * 60 * 1000 + 1);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(true);
        advanceDateAndTime(24 * 60 * 60 * 1000);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(false);
    });

    it("setJustRegisteredUserId(null)", () => {
        stubClient();
        (peg as any).matrixClient = peg.get();
        peg.setJustRegisteredUserId(null);
        expect(peg.currentUserIsJustRegistered()).toBe(false);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(false);
        advanceDateAndTime(1 * 60 * 60 * 1000 + 1);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(false);
    });
});
