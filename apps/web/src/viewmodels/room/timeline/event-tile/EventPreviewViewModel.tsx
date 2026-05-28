/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import { M_POLL_START, type MatrixClient, type MatrixEvent, MatrixEventEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type EventPreviewViewModel as EventPreviewViewModelInterface,
    type EventPreviewViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import { MessagePreviewStore } from "../../../../stores/message-preview";

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
    private eventListenerCleanups: Array<() => void> = [];
    private watchedEvent?: MatrixEvent;
    private previewRequestId = 0;
    private previewContentKey?: string;
    private previewContent?: ReactNode;

    private static readonly hiddenSnapshot: EventPreviewViewSnapshot = {
        isVisible: false,
    };

    public constructor(props: EventPreviewViewModelProps) {
        super(props, EventPreviewViewModel.hiddenSnapshot);

        this.disposables.track(() => this.teardownEventListeners());
        this.setupEventListeners(props.mxEvent);
        void this.updatePreview();
    }

    public setEvent(mxEvent?: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = {
            ...this.props,
            mxEvent,
        };
        this.setupEventListeners(mxEvent);
        void this.updatePreview();
    }

    public setClient(cli: MatrixClient): void {
        if (this.props.cli === cli) return;

        this.props = {
            ...this.props,
            cli,
        };
        void this.updatePreview();
    }

    private setupEventListeners(mxEvent?: MatrixEvent): void {
        if (this.watchedEvent === mxEvent) return;

        this.teardownEventListeners();
        this.watchedEvent = mxEvent;

        if (!mxEvent) return;

        mxEvent.on(MatrixEventEvent.Replaced, this.onEventContentChanged);
        mxEvent.on(MatrixEventEvent.Decrypted, this.onEventContentChanged);
        this.eventListenerCleanups.push(() => {
            mxEvent.off(MatrixEventEvent.Replaced, this.onEventContentChanged);
            mxEvent.off(MatrixEventEvent.Decrypted, this.onEventContentChanged);
        });
    }

    private teardownEventListeners(): void {
        for (const cleanup of this.eventListenerCleanups) {
            cleanup();
        }
        this.eventListenerCleanups = [];
        this.watchedEvent = undefined;
    }

    private onEventContentChanged = (): void => {
        void this.updatePreview();
    };

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

        const preview = MessagePreviewStore.instance.generatePreviewForEvent(mxEvent);
        if (!preview) {
            this.setHidden();
            return;
        }

        const prefix = EventPreviewViewModel.getPreviewPrefix(
            mxEvent.getType(),
            mxEvent.getContent().msgtype as MsgType | undefined,
        );

        this.snapshot.merge({
            isVisible: true,
            previewContent: this.getPreviewContent(preview, prefix),
            previewTooltip: prefix ? undefined : preview,
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

    private getPreviewContent(preview: string, prefix: string | null): ReactNode {
        const key = `${prefix ?? ""}\u0000${preview}`;
        if (this.previewContentKey === key && this.previewContent !== undefined) {
            return this.previewContent;
        }

        this.previewContentKey = key;
        this.previewContent = prefix
            ? _t(
                  "event_preview|preview",
                  {
                      prefix,
                      preview,
                  },
                  {
                      bold: (sub) => <strong>{sub}</strong>,
                  },
              )
            : preview;

        return this.previewContent;
    }

    private static getPreviewPrefix(type: string, msgType?: MsgType): string | null {
        switch (type) {
            case M_POLL_START.name:
                return _t("event_preview|prefix|poll");
            default:
        }

        switch (msgType) {
            case MsgType.Audio:
                return _t("event_preview|prefix|audio");
            case MsgType.Image:
                return _t("event_preview|prefix|image");
            case MsgType.Video:
                return _t("event_preview|prefix|video");
            case MsgType.File:
                return _t("event_preview|prefix|file");
            default:
                return null;
        }
    }
}
