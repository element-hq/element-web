/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin-solid";

import { _t } from "../../../languageHandler";

/**
 * A badge to indicate that a message is pinned.
 */
export function PinnedMessageBadge(): JSX.Element {
    return (
        <div className="mx_PinnedMessageBadge">
            <PinIcon width="16px" height="16px" />
            {_t("room|pinned_message_badge")}
        </div>
    );
}
