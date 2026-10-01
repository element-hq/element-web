/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import type {
    ClientCreationManagementApi as IClientCreationManagementApi,
    X509ClientInitOpts,
} from "@element-hq/element-web-module-api";

export class ClientCreationManagementApi implements IClientCreationManagementApi {
    public x509: X509ClientInitOpts | null = null;

    public setX509ClientInitOpts(opts: X509ClientInitOpts): void {
        // Merge so a module setting the CA PEM and the platform setting the signer don't clobber each other.
        this.x509 = { ...this.x509, ...opts };
    }

    /**
     * @deprecated Superseded by {@link setX509ClientInitOpts}; kept so modules built against 1.17.0 and
     * earlier keep working.
     */
    public setUserVerificationCaCertsPem(pem: string | null): void {
        this.setX509ClientInitOpts({ userVerificationCaCertsPem: pem ?? undefined });
    }
}
