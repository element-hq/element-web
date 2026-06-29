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
    "ghcr.io/element-hq/matrix-authentication-service:main@sha256:027ae2c6d9cff2322e5fdfd2059dadb21bf3f3d78a44a92ff7747f66028bf390";

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
