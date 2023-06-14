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

import { M_TEXT } from "matrix-js-sdk/src/@types/extensible_events";
import {
    ILocationContent,
    LocationAssetType,
    M_ASSET,
    M_LOCATION,
    M_TIMESTAMP,
} from "matrix-js-sdk/src/@types/location";
import { makeLocationContent } from "matrix-js-sdk/src/content-helpers";

import { isSelfLocation } from "../../../src/utils/location";

describe("isSelfLocation", () => {
    it("Returns true for a full m.asset event", () => {
        const content = makeLocationContent("", "0", Date.now());
        expect(isSelfLocation(content)).toBe(true);
    });

    it("Returns true for a missing m.asset", () => {
        const content = {
            body: "",
            msgtype: "m.location",
            geo_uri: "",
            [M_LOCATION.name]: { uri: "" },
            [M_TEXT.name]: "",
            [M_TIMESTAMP.name]: 0,
            // Note: no m.asset!
        } as unknown as ILocationContent;
        expect(isSelfLocation(content)).toBe(true);
    });

    it("Returns true for a missing m.asset type", () => {
        const content = {
            body: "",
            msgtype: "m.location",
            geo_uri: "",
            [M_LOCATION.name]: { uri: "" },
            [M_TEXT.name]: "",
            [M_TIMESTAMP.name]: 0,
            [M_ASSET.name]: {
                // Note: no type!
            },
        } as unknown as ILocationContent;
        expect(isSelfLocation(content)).toBe(true);
    });

    it("Returns false for an unknown asset type", () => {
        const content = makeLocationContent(
            undefined /* text */,
            "geo:foo",
            0,
            undefined /* description */,
            "org.example.unknown" as unknown as LocationAssetType,
        );
        expect(isSelfLocation(content)).toBe(false);
    });
});
