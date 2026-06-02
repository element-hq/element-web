/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { E2ePadlock, type E2ePadlockIcon } from "@element-hq/web-shared-components";

/**
 * Props for the {@link E2eStandardPadlockIcon} component.
 */
interface E2eStandardPadlockIconProps {
    /** Icon variant to render. */
    icon: E2ePadlockIcon;
    /** Accessible title for the icon. */
    title: string;
}

/**
 * Renders the standard end-to-end encryption padlock icon.
 */
export function E2eStandardPadlockIcon({ icon, title }: Readonly<E2eStandardPadlockIconProps>): JSX.Element {
    return (
        <E2ePadlock
            className={
                // Timeline PCSS uses this app class as a layout hook for positioning and layout variants.
                "mx_EventTile_e2eIcon"
            }
            title={title}
            icon={icon}
        />
    );
}
