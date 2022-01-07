/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import sdk from "../../../skinned-sdk";
import { textForLocation } from "../../../../src/components/views/location/LocationButton";

sdk.getComponent("LocationPicker");

describe("LocationButton", () => {
    describe("textForLocation", () => {
        it("with no description, simply dumps URI and date", () => {
            expect(textForLocation("geo:43.2,54.6", 12345, null)).toBe(
                "Location geo:43.2,54.6 at 1970-01-01T00:00:12.345Z");
        });

        it("with a description, includes that in the text", () => {
            expect(textForLocation("geo:12,43,3;u=2", 54321, "Me!")).toBe(
                'Location "Me!" geo:12,43,3;u=2 at 1970-01-01T00:00:54.321Z');
        });
    });
});
