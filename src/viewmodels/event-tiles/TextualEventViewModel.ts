/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";
import { MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { type EventTileTypeProps } from "../../events/EventTileFactory";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { textForEvent } from "../../TextForEvent";

export class TextualEventViewModel {
    private listeners = new Set<CallableFunction>();

    public constructor(private eventTileProps: EventTileTypeProps) {}

    public subscribe = (listener: CallableFunction) => {
        this.listeners.add(listener);
        this.updateSubscription();

        return () => {
            this.listeners.delete(listener);
            this.updateSubscription();
        };
    };

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private updateSubscription(): void {
        if (this.listeners.size > 0) {
            this.eventTileProps.mxEvent.on(MatrixEventEvent.SentinelUpdated, this.onEventSentinelUpdated);
        } else {
            this.eventTileProps.mxEvent.off(MatrixEventEvent.SentinelUpdated, this.onEventSentinelUpdated);
        }
    }

    private onEventSentinelUpdated = (): void => {
        this.emit();
    };

    public getSnapshot = (): string | ReactNode => {
        const text = textForEvent(
            this.eventTileProps.mxEvent,
            MatrixClientPeg.safeGet(),
            true,
            this.eventTileProps.showHiddenEvents,
        );
        return text;
    };
}
