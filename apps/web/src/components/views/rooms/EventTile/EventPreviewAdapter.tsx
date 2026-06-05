/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { EventPreviewView } from "@element-hq/web-shared-components";

import { type EventPreviewViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventPreviewViewModel";

/**
 * Props for the {@link EventPreviewAdapter} component.
 */
interface EventPreviewAdapterProps extends Omit<React.ComponentPropsWithoutRef<"span">, "children" | "title"> {
    /** View model owned by the parent event tile container. */
    vm: EventPreviewViewModel;
}

/**
 * Renders an event preview inside notification timeline tiles.
 */
export function EventPreviewAdapter({ vm, ...props }: Readonly<EventPreviewAdapterProps>): JSX.Element {
    return <EventPreviewView {...props} vm={vm} />;
}
