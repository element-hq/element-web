/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import React, { HTMLProps, JSX, useMemo } from "react";
import { M_POLL_START, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";

/**
 * The props for the {@link EventPreview} component.
 */
interface Props extends HTMLProps<HTMLSpanElement> {
    /**
     * The event to display the preview for
     */
    mxEvent: MatrixEvent;
}

/**
 * A component that displays a preview for the pinned event.
 */
function EventPreview({ mxEvent, className, ...props }: Props): JSX.Element | null {
    const preview = useEventPreview(mxEvent);
    if (!preview) return null;

    const classes = classNames("mx_EventPreview", className);
    const prefix = getPreviewPrefix(mxEvent.getType(), mxEvent.getContent().msgtype as MsgType);
    if (!prefix)
        return (
            <span {...props} className={classes}>
                {preview}
            </span>
        );

    return (
        <span {...props} className={classes}>
            {_t(
                "event_preview|preview",
                {
                    prefix,
                    preview,
                },
                {
                    bold: (sub) => <span className="mx_EventPreview_prefix">{sub}</span>,
                },
            )}
        </span>
    );
}

export default EventPreview;

/**
 * Hooks to generate a preview for the event.
 * @param mxEvent
 */
function useEventPreview(mxEvent: MatrixEvent | null): string | null {
    return useMemo(() => {
        if (!mxEvent || mxEvent.isRedacted() || mxEvent.isDecryptionFailure()) return null;
        return MessagePreviewStore.instance.generatePreviewForEvent(mxEvent);
    }, [mxEvent]);
}

/**
 * Get the prefix for the preview based on the type and the message type.
 * @param type
 * @param msgType
 */
function getPreviewPrefix(type: string, msgType: MsgType): string | null {
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
