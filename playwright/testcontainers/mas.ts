/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    MatrixAuthenticationServiceContainer as BaseMatrixAuthenticationServiceContainer,
    type StartedPostgreSqlContainer,
} from "@element-hq/element-web-playwright-common/lib/testcontainers";

const TAG = "main@sha256:09f64cd1633f1c82756b8e7d83cec4575b15782709674b0a69a4ad2a931e4e4f";

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
