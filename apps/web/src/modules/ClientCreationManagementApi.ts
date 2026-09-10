/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type { ClientCreationManagementApi as IClientCreationManagementApi } from "@element-hq/element-web-module-api";

export class ClientCreationManagementApi implements IClientCreationManagementApi {
    public userVerificationCaCertsPem: string | null = null;

    public setUserVerificationCaCertsPem(pem: string | null): void {
        this.userVerificationCaCertsPem = pem;
    }
}
