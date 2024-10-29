/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
