/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";
import {
    M_POLL_START,
    type MatrixEvent,
    MatrixEventEvent,
    MsgType,
    type Room,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { Disposables } from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import { MessagePreviewStore } from "../../../../stores/message-preview";

export interface EventPreviewContent {
    previewContent: ReactNode;
    previewTooltip?: string;
}

export class EventPreviewContentCache {
    private key?: string;
    private content?: ReactNode;

    public get(preview: string, prefix: string | null): ReactNode {
        const key = `${prefix ?? ""}\u0000${preview}`;
        if (this.key === key && this.content !== undefined) {
            return this.content;
        }

        this.key = key;
        this.content = prefix
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

        return this.content;
    }
}

export class MatrixEventContentChangeListener {
    private mxEvent?: MatrixEvent;
    private room?: Room;
    private callback?: () => void;
    private disposables?: Disposables;

    /**
     * Report changes to the content of an event: edits, decryption and redaction.
     *
     * @param mxEvent - The event to watch.
     * @param callback - Called when the event's content changes.
     * @param room - The event's room, which reports the redaction once the content has been removed.
     */
    public setEvent(mxEvent: MatrixEvent | undefined, callback: () => void, room?: Room): void {
        if (this.mxEvent === mxEvent && this.callback === callback && this.room === room) return;

        this.teardown();
        this.mxEvent = mxEvent;
        this.room = room;
        this.callback = callback;

        if (!mxEvent) return;

        this.disposables = new Disposables();
        this.disposables.trackListener(mxEvent, MatrixEventEvent.Replaced, callback);
        this.disposables.trackListener(mxEvent, MatrixEventEvent.Decrypted, callback);
        if (room) {
            // RoomEvent.Redaction passes the redaction event first.
            this.disposables.trackListener(room, RoomEvent.Redaction, (redaction: unknown) => {
                if ((redaction as MatrixEvent).getAssociatedId() === mxEvent.getId()) callback();
            });
        }
    }

    public teardown(): void {
        this.disposables?.dispose();
        this.disposables = undefined;
        this.mxEvent = undefined;
        this.room = undefined;
        this.callback = undefined;
    }
}

export function getEventPreviewContent(
    mxEvent: MatrixEvent,
    cache: EventPreviewContentCache,
): EventPreviewContent | null {
    const preview = MessagePreviewStore.instance.generatePreviewForEvent(mxEvent);
    if (!preview) {
        return null;
    }

    const prefix = getEventPreviewPrefix(mxEvent.getType(), mxEvent.getContent().msgtype as MsgType | undefined);

    return {
        previewContent: cache.get(preview, prefix),
        previewTooltip: prefix ? undefined : preview,
    };
}

function getEventPreviewPrefix(type: string, msgType?: MsgType): string | null {
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
