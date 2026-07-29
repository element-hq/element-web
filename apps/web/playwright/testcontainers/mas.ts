/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    MatrixAuthenticationServiceContainer as BaseMatrixAuthenticationServiceContainer,
    type StartedPostgreSqlContainer,
} from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";

const DOCKER_IMAGE =
    "ghcr.io/element-hq/matrix-authentication-service:main@sha256:4c81bf6b0d6e823f3d994ee05453a61820a9621079f452939108dc92483c31ce";

/**
 * MatrixAuthenticationServiceContainer which freezes the docker digest to
 * stabilise tests, updated periodically by the `playwright-image-updates.yaml`
 * workflow.
 */
export class MatrixAuthenticationServiceContainer extends BaseMatrixAuthenticationServiceContainer {
    public constructor(db: StartedPostgreSqlContainer) {
        super(db, DOCKER_IMAGE);
    }
}
