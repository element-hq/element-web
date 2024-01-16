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

import { M_AUTHENTICATION } from "matrix-js-sdk/src/matrix";

import { getDelegatedAuthAccountUrl } from "../../../src/utils/oidc/getDelegatedAuthAccountUrl";

describe("getDelegatedAuthAccountUrl()", () => {
    it("should return undefined when wk is undefined", () => {
        expect(getDelegatedAuthAccountUrl(undefined)).toBeUndefined();
    });

    it("should return undefined when wk has no authentication config", () => {
        expect(getDelegatedAuthAccountUrl({})).toBeUndefined();
    });

    it("should return undefined when wk authentication config has no configured account url", () => {
        expect(
            getDelegatedAuthAccountUrl({
                [M_AUTHENTICATION.stable!]: {
                    issuer: "issuer.org",
                },
            }),
        ).toBeUndefined();
    });

    it("should return the account url for authentication config using the unstable prefix", () => {
        expect(
            getDelegatedAuthAccountUrl({
                [M_AUTHENTICATION.unstable!]: {
                    issuer: "issuer.org",
                    account: "issuer.org/account",
                },
            }),
        ).toEqual("issuer.org/account");
    });

    it("should return the account url for authentication config using the stable prefix", () => {
        expect(
            getDelegatedAuthAccountUrl({
                [M_AUTHENTICATION.stable!]: {
                    issuer: "issuer.org",
                    account: "issuer.org/account",
                },
            }),
        ).toEqual("issuer.org/account");
    });
});
