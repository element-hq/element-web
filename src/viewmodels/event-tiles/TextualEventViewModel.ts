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
import { BaseViewModel } from "../base/BaseViewModel";

export class TextualEventViewModel extends BaseViewModel<TextualEventViewSnapshot, EventTileTypeProps> {
    public constructor(props: EventTileTypeProps) {
        super(props, "");
        this.setTextFromEvent();
    }

    private setTextFromEvent = (): void => {
        const text = textForEvent(this.props.mxEvent, MatrixClientPeg.safeGet(), true, this.props.showHiddenEvents);
        this.snapshot.set(text);
    };

    protected addDownstreamSubscription = (): void => {
        this.props.mxEvent.on(MatrixEventEvent.SentinelUpdated, this.setTextFromEvent);
    };

    protected removeDownstreamSubscription = (): void => {
        this.props.mxEvent.off(MatrixEventEvent.SentinelUpdated, this.setTextFromEvent);
    };
}
