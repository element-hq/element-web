/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type WrappedEvent } from "../MessagePanel";
import type MessagePanel from "../MessagePanel";

/* Grouper classes determine when events can be grouped together in a summary.
 * Groupers should have the following methods:
 * - canStartGroup (static): determines if a new group should be started with the
 *   given event
 * - shouldGroup: determines if the given event should be added to an existing group
 * - add: adds an event to an existing group (should only be called if shouldGroup
 *   return true)
 * - getTiles: returns the tiles that represent the group
 * - getNewPrevEvent: returns the event that should be used as the new prevEvent
 *   when determining things such as whether a date separator is necessary
 */
export abstract class BaseGrouper {
    public static canStartGroup = (_panel: MessagePanel, _ev: WrappedEvent): boolean => true;

    public events: WrappedEvent[] = [];
    // events that we include in the group but then eject out and place above the group.
    public ejectedEvents: WrappedEvent[] = [];
    public readMarker: ReactNode;

    public constructor(
        public readonly panel: MessagePanel,
        public readonly firstEventAndShouldShow: WrappedEvent,
        public readonly prevEvent: MatrixEvent | null,
        public readonly lastShownEvent: MatrixEvent | undefined,
        public readonly nextEvent: WrappedEvent | null,
        public readonly nextEventTile?: MatrixEvent | null,
    ) {
        this.readMarker = panel.readMarkerForEvent(
            firstEventAndShouldShow.event.getId()!,
            firstEventAndShouldShow.event === lastShownEvent,
        );
    }

    public abstract shouldGroup(ev: WrappedEvent): boolean;
    public abstract add(ev: WrappedEvent): void;
    public abstract getTiles(): ReactNode[];
    public abstract getNewPrevEvent(): MatrixEvent;
}
