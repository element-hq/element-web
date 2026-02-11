/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLProps, type JSX, useContext, useState } from "react";
import { type IContent, M_POLL_START, type MatrixEvent, MatrixEventEvent, MsgType } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter.ts";

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
 * A component that displays a preview for the given event.
 * Wraps both `useEventPreview` & `EventPreviewTile`.
 */
export function EventPreview({ mxEvent, className, ...props }: Props): JSX.Element | null {
    const preview = useEventPreview(mxEvent);
    if (!preview) return null;

    return <EventPreviewTile {...props} preview={preview} className={className} />;
}

/**
 * The props for the {@link EventPreviewTile} component.
 */
interface EventPreviewTileProps extends HTMLProps<HTMLSpanElement> {
    /**
     * The preview to display
     */
    preview: Preview;
}

/**
 * A component that displays a preview given the output from `useEventPreview`.
 */
export function EventPreviewTile({
    preview: [preview, prefix],
    className,
    ...props
}: EventPreviewTileProps): JSX.Element | null {
    const classes = classNames("mx_EventPreview", className);
    if (!prefix)
        return (
            <span {...props} className={classes} title={preview}>
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

type Preview = [preview: string, prefix: string | null];

/**
 * Hooks to generate a preview for the event.
 * @param mxEvent
 */
export function useEventPreview(mxEvent: MatrixEvent | undefined): Preview | null {
    const cli = useContext(MatrixClientContext);
    // track the content as a means to regenerate the preview upon edits & decryption
    const [content, setContent] = useState<IContent | undefined>(mxEvent?.getContent());
    useTypedEventEmitter(mxEvent ?? undefined, MatrixEventEvent.Replaced, () => {
        setContent(mxEvent!.getContent());
    });
    const awaitDecryption = mxEvent?.shouldAttemptDecryption() || mxEvent?.isBeingDecrypted();
    useTypedEventEmitter(awaitDecryption ? (mxEvent ?? undefined) : undefined, MatrixEventEvent.Decrypted, () => {
        setContent(mxEvent!.getContent());
    });

    return useAsyncMemo(
        async () => {
            if (!mxEvent || mxEvent.isRedacted() || mxEvent.isDecryptionFailure()) return null;
            await cli.decryptEventIfNeeded(mxEvent);
            return [
                MessagePreviewStore.instance.generatePreviewForEvent(mxEvent),
                getPreviewPrefix(mxEvent.getType(), content?.msgtype as MsgType),
            ];
        },
        [mxEvent, content],
        null,
    );
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
