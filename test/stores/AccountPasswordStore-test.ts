/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { AccountPasswordStore } from "../../src/stores/AccountPasswordStore";

jest.useFakeTimers();

describe("AccountPasswordStore", () => {
    let accountPasswordStore: AccountPasswordStore;

    beforeEach(() => {
        accountPasswordStore = new AccountPasswordStore();
    });

    it("should not have a password by default", () => {
        expect(accountPasswordStore.getPassword()).toBeUndefined();
    });

    describe("when setting a password", () => {
        beforeEach(() => {
            accountPasswordStore.setPassword("pass1");
        });

        it("should return the password", () => {
            expect(accountPasswordStore.getPassword()).toBe("pass1");
        });

        describe("and the password timeout exceed", () => {
            beforeEach(() => {
                jest.advanceTimersToNextTimer();
            });

            it("should clear the password", () => {
                expect(accountPasswordStore.getPassword()).toBeUndefined();
            });
        });

        describe("and setting another password", () => {
            beforeEach(() => {
                accountPasswordStore.setPassword("pass2");
            });

            it("should return the other password", () => {
                expect(accountPasswordStore.getPassword()).toBe("pass2");
            });
        });
    });
});
