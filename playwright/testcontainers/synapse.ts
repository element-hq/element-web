/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SynapseContainer as BaseSynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";

const TAG = "develop@sha256:2f464d71451431b58cc8425ac7894b5ecb1246df3595e7afa27eb5d29da5e113";

/**
 * SynapseContainer which freezes the docker digest to stabilise tests,
 * updated periodically by the `playwright-image-updates.yaml` workflow.
 */
export class SynapseContainer extends BaseSynapseContainer {
    public constructor() {
        super(`ghcr.io/element-hq/synapse:${TAG}`);
    }
}
