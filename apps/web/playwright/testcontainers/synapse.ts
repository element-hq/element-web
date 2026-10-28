/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SynapseContainer as BaseSynapseContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/index.js";

const DOCKER_IMAGE =
    "ghcr.io/element-hq/synapse:develop@sha256:72d501ec06c34d03a60cd6652d2ae924b0b3e391db797d4453fcd7a0620c6f30";

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
