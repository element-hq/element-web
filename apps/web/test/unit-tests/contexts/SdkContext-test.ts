/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { UserProfilesStore } from "../../../src/stores/UserProfilesStore";
import { createTestClient } from "../../test-utils";

describe("SdkContextClass", () => {
    let sdkContext = SdkContextClass.instance;
    let client: MatrixClient;

    beforeAll(() => {
        client = createTestClient();
    });

    beforeEach(() => {
        sdkContext = new SdkContextClass();
    });

    it("instance should always return the same instance", () => {
        const globalInstance = SdkContextClass.instance;
        expect(SdkContextClass.instance).toBe(globalInstance);
    });

    it("userProfilesStore should raise an error without a client", () => {
        expect(() => sdkContext.userProfilesStore).toThrow("Unable to create UserProfilesStore without a client");
    });

    describe("when SDKContext has a client", () => {
        beforeEach(() => {
            sdkContext.client = client;
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
            expect(sdkContext.userProfilesStore).not.toBe(store);
        });
    });
});
