/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type EventPreviewViewModel as EventPreviewViewModelInterface,
    type EventPreviewViewSnapshot,
} from "@element-hq/web-shared-components";

import {
    EventPreviewContentCache,
    getEventPreviewContent,
    MatrixEventContentChangeListener,
} from "./EventPreviewUtils";

export interface EventPreviewViewModelProps {
    /**
     * Matrix client used to decrypt event content before preview generation.
     */
    cli: MatrixClient;
    /**
     * The event to display the preview for.
     */
    mxEvent?: MatrixEvent;
}

export class EventPreviewViewModel
    extends BaseViewModel<EventPreviewViewSnapshot, EventPreviewViewModelProps>
    implements EventPreviewViewModelInterface
{
    private readonly eventContentListener = new MatrixEventContentChangeListener();
    private readonly previewContentCache = new EventPreviewContentCache();
    private previewRequestId = 0;
    private updatePreviewInFlight = false;
    private updatePreviewQueued = false;

    private static readonly hiddenSnapshot: EventPreviewViewSnapshot = {
        isVisible: false,
    };

    public constructor(props: EventPreviewViewModelProps) {
        super(props, EventPreviewViewModel.hiddenSnapshot);

        this.disposables.track(() => this.eventContentListener.teardown());
        this.eventContentListener.setEvent(props.mxEvent, this.onEventContentChanged);
        this.updatePreviewSafely();
    }

    public setEvent(mxEvent?: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = {
            ...this.props,
            mxEvent,
        };
        this.eventContentListener.setEvent(mxEvent, this.onEventContentChanged);
        this.updatePreviewSafely();
    }

    public setClient(cli: MatrixClient): void {
        if (this.props.cli === cli) return;

        this.props = {
            ...this.props,
            cli,
        };
        this.updatePreviewSafely();
    }

    private onEventContentChanged = (): void => {
        this.updatePreviewSafely();
    };

    private updatePreviewSafely(): void {
        if (this.updatePreviewInFlight) {
            this.updatePreviewQueued = true;
            return;
        }

        void this.drainPreviewUpdates();
    }

    private async drainPreviewUpdates(): Promise<void> {
        this.updatePreviewInFlight = true;

        try {
            do {
                this.updatePreviewQueued = false;
                try {
                    await this.updatePreview();
                } catch (error) {
                    logger.error("Failed to update event preview", error);
                }
            } while (this.updatePreviewQueued && !this.isDisposed);
        } finally {
            this.updatePreviewInFlight = false;
        }
    }

    private async updatePreview(): Promise<void> {
        const { cli, mxEvent } = this.props;
        const requestId = ++this.previewRequestId;

        if (!mxEvent || mxEvent.isRedacted() || mxEvent.isDecryptionFailure()) {
            this.setHidden();
            return;
        }

        try {
            await cli.decryptEventIfNeeded(mxEvent);
        } catch (error) {
            logger.error("Failed to decrypt event preview", error);
            if (this.isCurrentPreviewRequest(requestId, cli, mxEvent)) {
                this.setHidden();
            }
            return;
        }

        if (!this.isCurrentPreviewRequest(requestId, cli, mxEvent)) return;

        if (mxEvent.isRedacted() || mxEvent.isDecryptionFailure()) {
            this.setHidden();
            return;
        }

        const previewContent = getEventPreviewContent(mxEvent, this.previewContentCache);
        if (!previewContent) {
            this.setHidden();
            return;
        }

        this.snapshot.merge({
            isVisible: true,
            ...previewContent,
        });
    }

    private isCurrentPreviewRequest(requestId: number, cli: MatrixClient, mxEvent: MatrixEvent): boolean {
        return (
            !this.isDisposed &&
            requestId === this.previewRequestId &&
            this.props.cli === cli &&
            this.props.mxEvent === mxEvent
        );
    }

    private setHidden(): void {
        this.snapshot.merge({
            isVisible: false,
            previewContent: undefined,
            previewTooltip: undefined,
        });
    }
}
