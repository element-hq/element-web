/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

/**
 * Methods which manage aspects of the way the matrix-js-sdk Client is created and configured.
 * @public
 * @alpha
 */
export interface ClientCreationManagementApi {
    /**
     * Configure the crypto stack to trust user identities that are signed by particular certificate authorities.
     *
     * @param pem: Optional PEM-formatted string that provides CA certificates. These will be used to check
     *      X.509 signatures on user identities. Any user identity that has a valid signature according to the supplied
     *      CAs will be considered verified, without any manual verification taking place.
     */
    setUserVerificationCaCertsPem(pem: string | null): void;
}
