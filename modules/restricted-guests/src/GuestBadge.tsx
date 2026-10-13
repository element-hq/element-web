/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSX } from "react";
import { Text } from "@vector-im/compound-web";
import styled from "styled-components";
import GuestIcon from "@vector-im/compound-design-tokens/assets/web/icons/guest-solid";

interface GuestBadgeProps {
    /**
     * The text shown in the badge.
     */
    label: string;
}

/**
 * Badge with a guest icon, shown next to the name of a restricted guest.
 */
export function GuestBadge({ label }: GuestBadgeProps): JSX.Element {
    return (
        <Badge forwardedAs="span" size="sm" weight="medium">
            <GuestIcon width="16px" height="16px" color="var(--cpd-color-icon-info-primary)" />
            {label}
        </Badge>
    );
}

const Badge = styled(Text)`
    color: var(--cpd-color-text-badge-info);
    display: inline-flex;
    gap: var(--cpd-space-0-5x);
    align-items: center;
    min-height: 20px;
`;
