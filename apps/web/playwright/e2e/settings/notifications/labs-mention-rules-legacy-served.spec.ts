/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test } from "../../../element-web-test";
import { labsMentionNotificationSettingsTests } from "./labs-mention-rules";

test.use({
    displayName: "Alice",
    synapseConfig: {
        experimental_features: {
            // Serve the legacy text-matching mention rules (MSC4210)
            msc4210_enabled: false,
        },
    },
});

test.describe("Labs notification settings, legacy mention rules served", () => {
    labsMentionNotificationSettingsTests(true);
});
