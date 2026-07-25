/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { EventPreviewView } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link EventPreviewAdapter} component.
 */
interface EventPreviewAdapterProps extends Omit<React.ComponentPropsWithoutRef<"span">, "children" | "title"> {
    /** View model backing the event tile. */
    eventTileViewModel: EventTileViewModel;
    /** Matrix event whose preview is rendered. */
    mxEvent: MatrixEvent;
}

/**
 * Renders an event preview inside notification timeline tiles.
 */
export function EventPreviewAdapter({
    eventTileViewModel,
    mxEvent,
    ...props
}: Readonly<EventPreviewAdapterProps>): JSX.Element {
    const cli = useMatrixClientContext();
    const vm = eventTileViewModel.getEventPreviewViewModel({ cli, mxEvent });

    useEffect(() => {
        // This child VM owns Matrix listeners, so release it when the view using it leaves the tree.
        return () => eventTileViewModel.releaseEventPreviewViewModel();
    }, [eventTileViewModel]);

    useEffect(() => {
        vm.setClient(cli);
    }, [cli, vm]);

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    return <EventPreviewView {...props} vm={vm} />;
}
