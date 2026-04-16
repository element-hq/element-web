/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type RefObject, useContext, useEffect, useRef } from "react";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { MsgType } from "matrix-js-sdk/src/matrix";
import {
    EventContentBodyView,
    DecryptionFailureBodyView,
    FileBodyView,
    RedactedBodyView,
    TextualBodyView,
    type TextualBodyContentElement,
    type UrlPreview,
    UrlPreviewGroupView,
    VideoBodyView,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import { DecryptionFailureBodyViewModel } from "../../../viewmodels/room/timeline/event-tile/body/DecryptionFailureBodyViewModel";
import { TextualBodyViewModel } from "../../../viewmodels/room/timeline/event-tile/body/TextualBodyViewModel";
import { FileBodyViewModel } from "../../../viewmodels/message-body/FileBodyViewModel";
import { EventContentBodyViewModel } from "../../../viewmodels/message-body/EventContentBodyViewModel";
import { RedactedBodyViewModel } from "../../../viewmodels/message-body/RedactedBodyViewModel";
import { UrlPreviewGroupViewModel } from "../../../viewmodels/message-body/UrlPreviewGroupViewModel";
import { VideoBodyViewModel } from "../../../viewmodels/message-body/VideoBodyViewModel";
import { getParentEventId } from "../../../utils/Reply";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import PosthogTrackers from "../../../PosthogTrackers";
import ImageView from "../elements/ImageView";
import EditMessageComposer from "../rooms/EditMessageComposer";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";

type MBodyComponent = React.ComponentType<IBodyProps>;
const logger = rootLogger.getChild("TextualBodyFactory");

function getTextualBodyClassName(msgtype: MsgType | undefined): string {
    if (msgtype === MsgType.Notice) {
        return "mx_MNoticeBody mx_EventTile_content";
    }

    if (msgtype === MsgType.Emote) {
        return "mx_MEmoteBody mx_EventTile_content";
    }

    if ([MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video].includes(msgtype as MsgType)) {
        return "mx_MTextBody mx_EventTile_caption";
    }

    return "mx_MTextBody mx_EventTile_content";
}

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

export function TextualBodyFactory(props: Readonly<IBodyProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const client = useMatrixClientContext();
    const [mediaVisible] = useMediaVisible(props.mxEvent);
    const content = props.mxEvent.getContent();
    const isEmote = content.msgtype === MsgType.Emote;
    const willHaveWrapper = !!props.replacingEventId || !!props.isSeeingThroughMessageHiddenForModeration || isEmote;
    const stripReply = !props.mxEvent.replacingEvent() && !!getParentEventId(props.mxEvent);
    const contentRef = useRef<TextualBodyContentElement>(null);

    const textualBodyVm = useCreateAutoDisposedViewModel(
        () =>
            new TextualBodyViewModel({
                id: props.id,
                mxEvent: props.mxEvent,
                highlightLink: props.highlightLink,
                replacingEventId: props.replacingEventId,
                isSeeingThroughMessageHiddenForModeration: props.isSeeingThroughMessageHiddenForModeration,
                timelineRenderingType: roomContext.timelineRenderingType,
            }),
    );

    const eventContentBodyVm = useCreateAutoDisposedViewModel(
        () =>
            new EventContentBodyViewModel({
                as: willHaveWrapper ? "span" : "div",
                includeDir: false,
                mxEvent: props.mxEvent,
                content,
                stripReply,
                linkify: true,
                highlights: props.highlights,
                renderTooltipsForAmbiguousLinks: true,
                renderKeywordPills: true,
                renderMentionPills: true,
                renderCodeBlocks: true,
                renderSpoilers: true,
                client: roomContext.room?.client ?? client ?? null,
            }),
    );

    const urlPreviewVm = useCreateAutoDisposedViewModel(
        () =>
            new UrlPreviewGroupViewModel({
                client,
                mxEvent: props.mxEvent,
                mediaVisible,
                onImageClicked: (preview: UrlPreview): void => {
                    if (!preview.image?.imageFull) {
                        return;
                    }

                    Modal.createDialog(
                        ImageView,
                        {
                            src: preview.image.imageFull,
                            width: preview.image.width,
                            height: preview.image.height,
                            name: preview.title,
                            fileSize: preview.image.fileSize,
                            link: preview.link,
                        },
                        "mx_Dialog_lightbox",
                        undefined,
                        true,
                    );
                },
                visible: props.showUrlPreview ?? false,
            }),
    );

    const { previews } = useViewModel(urlPreviewVm);

    useEffect(() => {
        textualBodyVm.setId(props.id);
    }, [props.id, textualBodyVm]);

    useEffect(() => {
        textualBodyVm.setEvent(props.mxEvent);
    }, [props.mxEvent, textualBodyVm]);

    useEffect(() => {
        textualBodyVm.setHighlightLink(props.highlightLink);
    }, [props.highlightLink, textualBodyVm]);

    useEffect(() => {
        textualBodyVm.setReplacingEventId(props.replacingEventId);
    }, [props.replacingEventId, textualBodyVm]);

    useEffect(() => {
        textualBodyVm.setIsSeeingThroughMessageHiddenForModeration(props.isSeeingThroughMessageHiddenForModeration);
    }, [props.isSeeingThroughMessageHiddenForModeration, textualBodyVm]);

    useEffect(() => {
        textualBodyVm.setTimelineRenderingType(roomContext.timelineRenderingType);
    }, [roomContext.timelineRenderingType, textualBodyVm]);

    useEffect(() => {
        eventContentBodyVm.setEventContent(props.mxEvent, content);
    }, [content, props.mxEvent, eventContentBodyVm]);

    useEffect(() => {
        eventContentBodyVm.setStripReply(stripReply);
    }, [stripReply, eventContentBodyVm]);

    useEffect(() => {
        eventContentBodyVm.setAs(willHaveWrapper ? "span" : "div");
    }, [willHaveWrapper, eventContentBodyVm]);

    useEffect(() => {
        eventContentBodyVm.setHighlights(props.highlights);
    }, [props.highlights, eventContentBodyVm]);

    useEffect(() => {
        const eventElement = contentRef.current;
        if (!eventElement) {
            return;
        }

        void urlPreviewVm.updateEventElement(eventElement).catch((error) => {
            logger.warn("UrlPreviewViewModel failed to updateEventElement", error);
        });
    }, [
        props.mxEvent,
        props.highlights,
        props.replacingEventId,
        props.isSeeingThroughMessageHiddenForModeration,
        urlPreviewVm,
    ]);

    useEffect(() => {
        void urlPreviewVm.updateHidden(props.showUrlPreview ?? false, mediaVisible).catch((error) => {
            logger.warn("UrlPreviewViewModel failed to updateHidden", error);
        });
    }, [props.showUrlPreview, mediaVisible, urlPreviewVm]);

    useEffect(() => {
        if (previews.length === 0) {
            return;
        }

        PosthogTrackers.instance.trackUrlPreview(props.mxEvent.getId()!, props.mxEvent.isEncrypted(), previews);
    }, [props.mxEvent, previews]);

    if (props.editState) {
        const isWysiwygComposerEnabled = SettingsStore.getValue("feature_wysiwyg_composer");

        return isWysiwygComposerEnabled ? (
            <EditWysiwygComposer editorStateTransfer={props.editState} className="mx_EventTile_content" />
        ) : (
            <EditMessageComposer editState={props.editState} className="mx_EventTile_content" />
        );
    }

    return (
        <TextualBodyView
            vm={textualBodyVm}
            body={<EventContentBodyView vm={eventContentBodyVm} as={willHaveWrapper ? "span" : "div"} />}
            bodyRef={contentRef}
            urlPreviews={<UrlPreviewGroupView vm={urlPreviewVm} />}
            className={getTextualBodyClassName(content.msgtype as MsgType | undefined)}
        />
    );
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
    [MsgType.File, FileBodyFactory],
    [MsgType.Video, VideoBodyFactory],
    [MsgType.Text, TextualBodyFactory],
    [MsgType.Notice, TextualBodyFactory],
    [MsgType.Emote, TextualBodyFactory],
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
