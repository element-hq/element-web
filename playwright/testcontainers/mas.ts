/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    MatrixAuthenticationServiceContainer as BaseMatrixAuthenticationServiceContainer,
    type StartedPostgreSqlContainer,
} from "@element-hq/element-web-playwright-common/lib/testcontainers";

const TAG = "main@sha256:120ee610e6a1777037cbb2a2d1e3609178dfde262d2ea8ef03cd92fcd9cb500d";

/**
 * MatrixAuthenticationServiceContainer which freezes the docker digest to
 * stabilise tests, updated periodically by the `playwright-image-updates.yaml`
 * workflow.
 */
export class MatrixAuthenticationServiceContainer extends BaseMatrixAuthenticationServiceContainer {
    public constructor(db: StartedPostgreSqlContainer) {
        super(db, `ghcr.io/element-hq/matrix-authentication-service:${TAG}`);
    }
}
