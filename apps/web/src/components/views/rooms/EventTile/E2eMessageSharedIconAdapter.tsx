/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { E2eMessageSharedIconView } from "@element-hq/web-shared-components";

import { type E2eMessageSharedIconViewModel } from "../../../../viewmodels/room/timeline/event-tile/E2eMessageSharedIconViewModel";

/**
 * Props for the {@link E2eMessageSharedIconAdapter} component.
 */
interface E2eMessageSharedIconAdapterProps {
    /** View model owned by the parent event tile container. */
    vm: E2eMessageSharedIconViewModel;
}

/**
 * Renders the end-to-end encryption key-sharing indicator.
 */
export function E2eMessageSharedIconAdapter({ vm }: Readonly<E2eMessageSharedIconAdapterProps>): JSX.Element {
    return (
        <E2eMessageSharedIconView
            vm={vm}
            className={
                // Timeline PCSS uses this app class as a layout hook for positioning and layout variants.
                "mx_EventTile_e2eIcon"
            }
        />
    );
}
