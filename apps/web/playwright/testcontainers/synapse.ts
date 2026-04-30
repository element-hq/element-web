/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SynapseContainer as BaseSynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";

const DOCKER_IMAGE =
    "ghcr.io/element-hq/synapse:develop@sha256:53b1c81dc161be1d999344ca727a520972b912fc24681dfafe25fca4b766b2a5";

/**
 * SynapseContainer which freezes the docker digest to stabilise tests,
 * updated periodically by the `playwright-image-updates.yaml` workflow.
 */
export class SynapseContainer extends BaseSynapseContainer {
    public constructor() {
        super(DOCKER_IMAGE);
    }
}
