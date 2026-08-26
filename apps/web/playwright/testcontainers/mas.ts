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
    "ghcr.io/element-hq/matrix-authentication-service:main@sha256:875db8ee011704735ac3b7c65c86f51ab8d83bcf59f2d427c5866d631e8e8396";

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
