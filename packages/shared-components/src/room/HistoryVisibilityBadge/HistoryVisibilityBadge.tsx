/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Badge } from "@vector-im/compound-web";
import {
    HistoryIcon,
    UserProfileSolidIcon,
    VisibilityOffIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../utils/i18n";

interface Props {
    /** The history visibility of the room, according to the room state. */
    historyVisibility: "invited" | "joined" | "shared" | "world_readable";
}

/** A badge showing the history visibility of a room. */
export function HistoryVisibilityBadge({ historyVisibility }: Props): JSX.Element | null {
    const iconProps = {
        color: "var(--cpd-color-icon-info-primary)",
        width: "1rem", // 16px at the default font size, per the design
        height: "1rem",
    };
    switch (historyVisibility) {
        case "invited":
        case "joined":
            return (
                <Badge kind="blue">
                    <VisibilityOffIcon {...iconProps} />
                    {_t("room|history_visibility_badge|private")}
                </Badge>
            );
        case "shared":
            return (
                <Badge kind="blue">
                    <HistoryIcon {...iconProps} />
                    {_t("room|history_visibility_badge|shared")}
                </Badge>
            );
        case "world_readable":
            return (
                <Badge kind="blue">
                    <UserProfileSolidIcon {...iconProps} />
                    {_t("room|history_visibility_badge|world_readable")}
                </Badge>
            );
        default:
            return null;
    }
}
