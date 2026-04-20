/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type RefObject, useContext, useEffect, useRef } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";
import {
    DecryptionFailureBodyView,
    FileBodyView,
    ImageBodyView,
    RedactedBodyView,
    VideoBodyView,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import { DecryptionFailureBodyViewModel } from "../../../viewmodels/room/timeline/event-tile/body/DecryptionFailureBodyViewModel";
import { FileBodyViewModel } from "../../../viewmodels/message-body/FileBodyViewModel";
import { ImageBodyViewModel } from "../../../viewmodels/message-body/ImageBodyViewModel";
import { RedactedBodyViewModel } from "../../../viewmodels/message-body/RedactedBodyViewModel";
import { VideoBodyViewModel } from "../../../viewmodels/message-body/VideoBodyViewModel";
import { isMimeTypeAllowed } from "../../../utils/blobs";

type MBodyComponent = React.ComponentType<IBodyProps>;

export function FileBodyFactory({
    mxEvent,
    mediaEventHelper,
    forExport,
    showFileInfo,
}: Pick<IBodyProps, "mxEvent" | "mediaEventHelper" | "forExport" | "showFileInfo">): JSX.Element {
    const { timelineRenderingType } = useContext(RoomContext);
    const refIFrame = useRef<HTMLIFrameElement>(null) as RefObject<HTMLIFrameElement>;
    const refLink = useRef<HTMLAnchorElement>(null) as RefObject<HTMLAnchorElement>;

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new FileBodyViewModel({
                mxEvent,
                mediaEventHelper,
                forExport,
                showFileInfo,
                timelineRenderingType,
                refIFrame,
                refLink,
            }),
    );

    useEffect(() => {
        vm.setProps({
            mxEvent,
            mediaEventHelper,
            forExport,
            showFileInfo,
            timelineRenderingType,
        });
    }, [mxEvent, mediaEventHelper, forExport, showFileInfo, timelineRenderingType, vm]);

    return <FileBodyView vm={vm} refIFrame={refIFrame} refLink={refLink} className="mx_MFileBody" />;
}

export function VideoBodyFactory({
    mxEvent,
    mediaEventHelper,
    forExport,
    inhibitInteraction,
}: Readonly<Pick<IBodyProps, "mxEvent" | "mediaEventHelper" | "forExport" | "inhibitInteraction">>): JSX.Element {
    const { timelineRenderingType } = useContext(RoomContext);
    const [mediaVisible, setMediaVisible] = useMediaVisible(mxEvent);
    const videoRef = useRef<HTMLVideoElement>(null);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new VideoBodyViewModel({
                mxEvent,
                mediaEventHelper,
                forExport,
                inhibitInteraction,
                mediaVisible,
                onPreviewClick: (): void => setMediaVisible(true),
                videoRef,
            }),
    );

    useEffect(() => {
        vm.loadInitialMediaIfVisible();
    }, [vm]);

    useEffect(() => {
        vm.setEvent(mxEvent, mediaEventHelper);
    }, [mxEvent, mediaEventHelper, vm]);

    useEffect(() => {
        vm.setForExport(forExport);
    }, [forExport, vm]);

    useEffect(() => {
        vm.setInhibitInteraction(inhibitInteraction);
    }, [inhibitInteraction, vm]);

    useEffect(() => {
        vm.setMediaVisible(mediaVisible);
    }, [mediaVisible, vm]);

    useEffect(() => {
        vm.setOnPreviewClick((): void => setMediaVisible(true));
    }, [setMediaVisible, vm]);

    const showFileBody =
        !forExport &&
        timelineRenderingType !== TimelineRenderingType.Room &&
        timelineRenderingType !== TimelineRenderingType.Pinned &&
        timelineRenderingType !== TimelineRenderingType.Search;

    return (
        <VideoBodyView
            vm={vm}
            className="mx_MVideoBody"
            containerClassName="mx_MVideoBody_container"
            videoRef={videoRef}
        >
            {showFileBody ? (
                <FileBodyFactory
                    mxEvent={mxEvent}
                    mediaEventHelper={mediaEventHelper}
                    forExport={forExport}
                    showFileInfo={false}
                />
            ) : null}
        </VideoBodyView>
    );
}

export function ImageBodyFactory({
    mxEvent,
    mediaEventHelper,
    forExport,
    maxImageHeight,
    permalinkCreator,
    showFileInfo,
}: Readonly<
    Pick<IBodyProps, "mxEvent" | "mediaEventHelper" | "forExport" | "maxImageHeight" | "permalinkCreator" | "showFileInfo">
>): JSX.Element {
    const { timelineRenderingType } = useContext(RoomContext);
    const [mediaVisible, setMediaVisible] = useMediaVisible(mxEvent);
    const imageRef = useRef<HTMLImageElement>(null);
    const content = mxEvent.getContent<ImageContent>();
    const shouldFallbackToFileBody =
        mediaEventHelper?.media.isEncrypted === true &&
        !isMimeTypeAllowed(content.info?.mimetype ?? "") &&
        !content.info?.thumbnail_info;

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ImageBodyViewModel({
                mxEvent,
                mediaEventHelper,
                forExport,
                maxImageHeight,
                mediaVisible,
                permalinkCreator,
                timelineRenderingType,
                imageRef,
                setMediaVisible,
            }),
    );

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.loadInitialMediaIfVisible();
    }, [shouldFallbackToFileBody, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setEvent(mxEvent, mediaEventHelper);
    }, [mediaEventHelper, mxEvent, shouldFallbackToFileBody, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setForExport(forExport);
    }, [forExport, shouldFallbackToFileBody, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setMaxImageHeight(maxImageHeight);
    }, [maxImageHeight, shouldFallbackToFileBody, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setMediaVisible(mediaVisible);
    }, [mediaVisible, shouldFallbackToFileBody, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setPermalinkCreator(permalinkCreator);
    }, [permalinkCreator, shouldFallbackToFileBody, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setTimelineRenderingType(timelineRenderingType);
    }, [shouldFallbackToFileBody, timelineRenderingType, vm]);

    useEffect(() => {
        if (shouldFallbackToFileBody) return;
        vm.setSetMediaVisible(setMediaVisible);
    }, [setMediaVisible, shouldFallbackToFileBody, vm]);

    const showFileBody =
        !forExport &&
        timelineRenderingType !== TimelineRenderingType.Room &&
        timelineRenderingType !== TimelineRenderingType.Pinned &&
        timelineRenderingType !== TimelineRenderingType.Search &&
        timelineRenderingType !== TimelineRenderingType.Thread &&
        timelineRenderingType !== TimelineRenderingType.ThreadsList;

    if (shouldFallbackToFileBody) {
        return (
            <FileBodyFactory
                mxEvent={mxEvent}
                mediaEventHelper={mediaEventHelper}
                forExport={forExport}
                showFileInfo={showFileInfo}
            />
        );
    }

    return (
        <ImageBodyView
            vm={vm}
            className="mx_MImageBody"
            containerClassName="mx_MImageBody_thumbnail_container"
            imageClassName="mx_MImageBody_thumbnail"
            imageRef={imageRef}
        >
            {showFileBody ? (
                <FileBodyFactory
                    mxEvent={mxEvent}
                    mediaEventHelper={mediaEventHelper}
                    forExport={forExport}
                    showFileInfo={false}
                />
            ) : null}
        </ImageBodyView>
    );
}

export function RedactedBodyFactory({ mxEvent, ref }: Pick<IBodyProps, "mxEvent" | "ref">): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new RedactedBodyViewModel({ mxEvent }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    return <RedactedBodyView vm={vm} ref={ref} className="mx_RedactedBody" />;
}

export function DecryptionFailureBodyFactory({ mxEvent, ref }: Pick<IBodyProps, "mxEvent" | "ref">): JSX.Element {
    const verificationState = useContext(LocalDeviceVerificationStateContext);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new DecryptionFailureBodyViewModel({
                decryptionFailureCode: mxEvent.decryptionFailureReason,
                verificationState,
            }),
    );

    useEffect(() => {
        vm.setDecryptionFailureCode(mxEvent.decryptionFailureReason);
        vm.setVerificationState(verificationState);
    }, [mxEvent, verificationState, vm]);

    return <DecryptionFailureBodyView vm={vm} ref={ref} className="mx_DecryptionFailureBody mx_EventTile_content" />;
}

// Message body factory registry for bodies that already route through view-model-backed wrappers.
const MESSAGE_BODY_TYPES = new Map<string, MBodyComponent>([
    [MsgType.Image, ImageBodyFactory],
    [MsgType.File, FileBodyFactory],
    [MsgType.Video, VideoBodyFactory],
]);

// Render a body using the picked factory.
// Falls back to the provided factory when msgtype has no specific handler.
export function renderMBody(props: IBodyProps, fallbackFactory?: MBodyComponent): JSX.Element | null {
    const BodyType = MESSAGE_BODY_TYPES.get(props.mxEvent.getContent().msgtype as string) ?? fallbackFactory;
    if (!BodyType) {
        return null;
    }

    return <BodyType {...props} />;
}
