/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { type TextualEventViewSnapshot, BaseViewModel } from "@element-hq/web-shared-components";

import { type EventTileTypeProps } from "../../../../events/EventTileFactory";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { textForEvent } from "../../../../TextForEvent";

export class TextualEventViewModel extends BaseViewModel<TextualEventViewSnapshot, EventTileTypeProps> {
    private listenedEvent?: EventTileTypeProps["mxEvent"];

    public constructor(props: EventTileTypeProps) {
        super(props, { content: "" });
        this.rebindListener(props.mxEvent);
        this.setTextFromEvent();
    }

    public override dispose(): void {
        this.rebindListener(undefined);
        super.dispose();
    }

    public updateProps(props: EventTileTypeProps): void {
        const previousEvent = this.props.mxEvent;
        this.props = props;

        if (previousEvent !== props.mxEvent) {
            this.rebindListener(props.mxEvent);
        }

        this.setTextFromEvent();
    }

    private setTextFromEvent = (): void => {
        const content = textForEvent(this.props.mxEvent, MatrixClientPeg.safeGet(), true, this.props.showHiddenEvents);
        this.snapshot.set({ content });
    };

    private rebindListener(mxEvent: MatrixEvent | undefined): void {
        if (this.listenedEvent) {
            this.listenedEvent.off(MatrixEventEvent.SentinelUpdated, this.setTextFromEvent);
        }

        this.listenedEvent = mxEvent;

        if (mxEvent) {
            mxEvent.on(MatrixEventEvent.SentinelUpdated, this.setTextFromEvent);
        }
    }
}
