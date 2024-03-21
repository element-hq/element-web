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
