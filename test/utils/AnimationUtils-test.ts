/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import { lerp } from "../../src/utils/AnimationUtils";

describe("lerp", () => {
    it("correctly interpolates", () => {
        expect(lerp(0, 100, 0.5)).toBe(50);
        expect(lerp(50, 100, 0.5)).toBe(75);
        expect(lerp(0, 1, 0.1)).toBe(0.1);
    });

    it("clamps the interpolant", () => {
        expect(lerp(0, 100, 50)).toBe(100);
        expect(lerp(0, 100, -50)).toBe(0);
    });

    it("handles negative numbers", () => {
        expect(lerp(-100, 0, 0.5)).toBe(-50);
        expect(lerp(100, -100, 0.5)).toBe(0);
    });
});
