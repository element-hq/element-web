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

import { locationEventGeoUri } from "../../../src/utils/location";
import { makeLegacyLocationEvent, makeLocationEvent } from "../../test-utils/location";

describe("locationEventGeoUri()", () => {
    it("returns m.location uri when available", () => {
        expect(locationEventGeoUri(makeLocationEvent("geo:51.5076,-0.1276"))).toEqual("geo:51.5076,-0.1276");
    });

    it("returns legacy uri when m.location content not found", () => {
        expect(locationEventGeoUri(makeLegacyLocationEvent("geo:51.5076,-0.1276"))).toEqual("geo:51.5076,-0.1276");
    });
});
