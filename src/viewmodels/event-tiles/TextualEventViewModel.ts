/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { type EventTileTypeProps } from "../../events/EventTileFactory";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { textForEvent } from "../../TextForEvent";
import { type TextualEventViewSnapshot } from "../../shared-components/event-tiles/TextualEvent/TextualEvent";
import { SubscriptionViewModel } from "../SubscriptionViewModel";

export class TextualEventViewModel extends SubscriptionViewModel<TextualEventViewSnapshot> {
    public constructor(private eventTileProps: EventTileTypeProps) {
        super();
    }

    protected addDownstreamSubscription = (): void => {
        this.eventTileProps.mxEvent.on(MatrixEventEvent.SentinelUpdated, this.subs.emit);
    };

    protected removeDownstreamSubscription = (): void => {
        this.eventTileProps.mxEvent.off(MatrixEventEvent.SentinelUpdated, this.subs.emit);
    };

    public getSnapshot = (): TextualEventViewSnapshot => {
        const text = textForEvent(
            this.eventTileProps.mxEvent,
            MatrixClientPeg.safeGet(),
            true,
            this.eventTileProps.showHiddenEvents,
        );
        return text;
    };
}
