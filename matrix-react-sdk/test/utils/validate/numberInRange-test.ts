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

import { validateNumberInRange } from "../../../src/utils/validate";

describe("validateNumberInRange", () => {
    const min = 1;
    const max = 10;
    it("returns false when value is a not a number", () => {
        expect(validateNumberInRange(min, max)("test" as unknown as number)).toEqual(false);
    });
    it("returns false when value is undefined", () => {
        expect(validateNumberInRange(min, max)(undefined)).toEqual(false);
    });
    it("returns false when value is NaN", () => {
        expect(validateNumberInRange(min, max)(NaN)).toEqual(false);
    });
    it("returns true when value is equal to min", () => {
        expect(validateNumberInRange(min, max)(min)).toEqual(true);
    });
    it("returns true when value is equal to max", () => {
        expect(validateNumberInRange(min, max)(max)).toEqual(true);
    });
    it("returns true when value is an int in range", () => {
        expect(validateNumberInRange(min, max)(2)).toEqual(true);
    });
    it("returns true when value is a float in range", () => {
        expect(validateNumberInRange(min, max)(2.2)).toEqual(true);
    });
});
