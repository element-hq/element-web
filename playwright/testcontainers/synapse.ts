/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SynapseContainer as BaseSynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers";

const TAG = "develop@sha256:c73928c05058a860c0f4cd3c17032c0fc398a4e5db05a20cb660b3e16ae96e98";

/**
 * SynapseContainer which freezes the docker digest to stabilise tests,
 * updated periodically by the `playwright-image-updates.yaml` workflow.
 */
export class SynapseContainer extends BaseSynapseContainer {
    public constructor() {
        super(`ghcr.io/element-hq/synapse:${TAG}`);
    }
}
