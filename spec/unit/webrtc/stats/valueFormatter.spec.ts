/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { ValueFormatter } from "../../../../src/webrtc/stats/valueFormatter";

describe("ValueFormatter", () => {
    describe("on get non negative values", () => {
        it("formatter shod return number", async () => {
            expect(ValueFormatter.getNonNegativeValue("2")).toEqual(2);
            expect(ValueFormatter.getNonNegativeValue(0)).toEqual(0);
            expect(ValueFormatter.getNonNegativeValue("-2")).toEqual(0);
            expect(ValueFormatter.getNonNegativeValue("")).toEqual(0);
            expect(ValueFormatter.getNonNegativeValue(NaN)).toEqual(0);
        });
    });
});
