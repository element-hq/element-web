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

const PASSWORD_TIMEOUT = 5 * 60 * 1000; // five minutes

/**
 * Store for the account password.
 * This password can be used for a short time after login
 * to avoid requestin the password all the time for instance during e2ee setup.
 */
export class AccountPasswordStore {
    private password?: string;
    private passwordTimeoutId?: ReturnType<typeof setTimeout>;

    public setPassword(password: string): void {
        this.password = password;
        clearTimeout(this.passwordTimeoutId);
        this.passwordTimeoutId = setTimeout(this.clearPassword, PASSWORD_TIMEOUT);
    }

    public getPassword(): string | undefined {
        return this.password;
    }

    public clearPassword = (): void => {
        clearTimeout(this.passwordTimeoutId);
        this.passwordTimeoutId = undefined;
        this.password = undefined;
    };
}
