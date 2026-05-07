/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext, useEffect, useRef } from "react";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { MsgType } from "matrix-js-sdk/src/matrix";
import {
    EventContentBodyView,
    TextualBodyView,
    type TextualBodyContentElement,
    type UrlPreview,
    UrlPreviewGroupView,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import { TextualBodyViewModel } from "../../../viewmodels/room/timeline/event-tile/body/TextualBodyViewModel";
import { EventContentBodyViewModel } from "../../../viewmodels/message-body/EventContentBodyViewModel";
import { UrlPreviewGroupViewModel } from "../../../viewmodels/message-body/UrlPreviewGroupViewModel";
import { getParentEventId } from "../../../utils/Reply";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import PosthogTrackers from "../../../PosthogTrackers";
import ImageView from "../elements/ImageView";
import EditMessageComposer from "../rooms/EditMessageComposer";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";

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
            urlPreviews={<UrlPreviewGroupView vm={urlPreviewVm} className="mx_TextualBody_urlPreviews" />}
            className={getTextualBodyClassName(content.msgtype as MsgType | undefined)}
        />
    );
}
