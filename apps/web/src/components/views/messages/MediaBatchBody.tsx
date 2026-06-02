/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useMemo } from "react";
import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { type IBodyProps } from "./IBodyProps";
import { ImageBodyFactory } from "./MBodyFactory";
import { TextualBodyFactory } from "./TextualBodyFactory";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";

interface MediaBatchBodyProps extends IBodyProps {
    mediaBatchEvents: MatrixEvent[];
}

function useMediaHelper(mxEvent: MatrixEvent): MediaEventHelper | undefined {
    const mediaHelper = useMemo(
        () => (MediaEventHelper.isEligible(mxEvent) ? new MediaEventHelper(mxEvent) : undefined),
        [mxEvent],
    );

    useEffect(() => {
        return () => {
            mediaHelper?.destroy();
        };
    }, [mediaHelper]);

    return mediaHelper;
}

function MediaBatchImage({ mxEvent, bodyProps, index }: { mxEvent: MatrixEvent; bodyProps: IBodyProps; index: number }): JSX.Element {
    const mediaEventHelper = useMediaHelper(mxEvent);

    return (
        <div className="mx_MediaBatchBody_item" data-event-id={mxEvent.getId()} data-media-batch-index={index}>
            <ImageBodyFactory
                mxEvent={mxEvent}
                mediaEventHelper={mediaEventHelper}
                forExport={bodyProps.forExport}
                maxImageHeight={bodyProps.maxImageHeight ?? 180}
                permalinkCreator={bodyProps.permalinkCreator}
                showFileInfo={bodyProps.showFileInfo}
            />
        </div>
    );
}

export function hasMediaCaption(mxEvent: MatrixEvent): boolean {
    const content = mxEvent.getContent();
    return (
        [MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video].includes(content.msgtype as MsgType) &&
        !!content.filename &&
        content.filename !== content.body
    );
}

export default function MediaBatchBody({ mediaBatchEvents, ...bodyProps }: MediaBatchBodyProps): JSX.Element {
    const captionEvent = mediaBatchEvents.find(hasMediaCaption) ?? bodyProps.mxEvent;
    const captionProps = {
        ...bodyProps,
        ref: undefined,
        mxEvent: captionEvent,
    };

    return (
        <div
            className="mx_EventTile_content mx_MediaBatchBody"
            data-testid="media-batch-body"
            data-media-batch-count={mediaBatchEvents.length}
        >
            <div className="mx_MediaBatchBody_images">
                {mediaBatchEvents.map((mxEvent, index) => (
                    <MediaBatchImage
                        key={mxEvent.getId() ?? mxEvent.getTxnId() ?? index}
                        mxEvent={mxEvent}
                        bodyProps={bodyProps}
                        index={index}
                    />
                ))}
            </div>
            {hasMediaCaption(captionEvent) ? <TextualBodyFactory {...captionProps} /> : null}
        </div>
    );
}
