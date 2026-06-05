/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { ThreadMessagePreviewView } from "@element-hq/web-shared-components";

import { type ThreadMessagePreviewViewModel } from "../../../../viewmodels/room/timeline/event-tile/ThreadSummaryViewModel.tsx";

/**
 * Props for the {@link ThreadMessagePreviewAdapter} component.
 */
interface ThreadMessagePreviewAdapterProps {
    /** View model owned by the parent event tile container. */
    vm: ThreadMessagePreviewViewModel;
}

/**
 * Renders the preview shown for a thread message.
 */
export function ThreadMessagePreviewAdapter({ vm }: Readonly<ThreadMessagePreviewAdapterProps>): JSX.Element {
    return <ThreadMessagePreviewView vm={vm} />;
}
