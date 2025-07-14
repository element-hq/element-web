/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { type EventTileTypeProps } from "../../events/EventTileFactory";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { textForEvent } from "../../TextForEvent";
import { ViewModelSubscriptions } from "../ViewModelSubscriptions";
import { type TextualEventViewSnapshot } from "../../shared-components/event-tiles/TextualEvent/TextualEvent";
import { type ViewModel } from "../../shared-components/ViewModel";

export class TextualEventViewModel implements ViewModel<TextualEventViewSnapshot> {
    private subs: ViewModelSubscriptions;

    public constructor(private eventTileProps: EventTileTypeProps) {
        this.subs = new ViewModelSubscriptions(this.addSubscription, this.removeSubscription);
    }

    private addSubscription = (): void => {
        this.eventTileProps.mxEvent.on(MatrixEventEvent.SentinelUpdated, this.onEventSentinelUpdated);
    };

    private removeSubscription = (): void => {
        this.eventTileProps.mxEvent.off(MatrixEventEvent.SentinelUpdated, this.onEventSentinelUpdated);
    };

    public subscribe = (listener: () => void): (() => void) => {
        return this.subs.add(listener);
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

    private onEventSentinelUpdated = (): void => {
        this.subs.emit();
    };
}
