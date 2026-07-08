/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { SDKContextClass } from "../../../src/contexts/SDKContextClass";
import { UserProfilesStore } from "../../../src/stores/UserProfilesStore";
import { createTestClient } from "../../test-utils";
import { TestSDKContext } from "../TestSDKContext.ts";

describe("SDKContextClass", () => {
    let sdkContext: TestSDKContext;
    let client: MatrixClient;

    beforeAll(() => {
        client = createTestClient();
    });

    beforeEach(() => {
        sdkContext = new TestSDKContext();
    });

    it("instance should always return the same instance", () => {
        const globalInstance = SDKContextClass.instance;
        expect(SDKContextClass.instance).toBe(globalInstance);
    });

    it("userProfilesStore should raise an error without a client", () => {
        expect(() => sdkContext.userProfilesStore).toThrow("Unable to create UserProfilesStore without a client");
    });

    describe("when SDKContext has a client", () => {
        beforeEach(() => {
            sdkContext._client = client;
        });

        it("userProfilesStore should return a UserProfilesStore", () => {
            const store = sdkContext.userProfilesStore;
            expect(store).toBeInstanceOf(UserProfilesStore);
            // it should return the same instance
            expect(sdkContext.userProfilesStore).toBe(store);
        });

        it("onLoggedOut should clear the UserProfilesStore", () => {
            const store = sdkContext.userProfilesStore;
            sdkContext.onLoggedOut();
            sdkContext._client = client;
            expect(sdkContext.userProfilesStore).not.toBe(store);
        });
    });
});
