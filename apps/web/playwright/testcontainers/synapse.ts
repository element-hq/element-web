/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SynapseContainer as BaseSynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";

const DOCKER_IMAGE =
    "ghcr.io/element-hq/synapse:develop@sha256:ddb62e0302dcda403888c901cd0ce587005fc89fec0c5bb84a7043d5a718b65b";

/**
 * SynapseContainer which freezes the docker digest to stabilise tests,
 * updated periodically by the `playwright-image-updates.yaml` workflow.
 */
export class SynapseContainer extends BaseSynapseContainer {
    public constructor() {
        super(DOCKER_IMAGE);
        // Synapse advertises the `m.preview_url` capability based on `url_preview_enabled`, and the client hides
        // URL previews when it is disabled. Tests mock the preview responses, so block every IP range to ensure
        // Synapse never fetches a real URL.
        this.withConfigField("url_preview_enabled", true);
        this.withConfigField("url_preview_ip_range_blacklist", ["0.0.0.0/0", "::/0"]);
    }
}
