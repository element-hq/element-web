/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext, useEffect, useRef } from "react";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { MsgType } from "matrix-js-sdk/src/matrix";
import {
    _t,
    EventContentBodyView,
    TextualBodyView,
    type TextualBodyContentElement,
    type UrlPreview,
    useCreateAutoDisposedViewModel,
    MediaPreviewGroupPreview,
    useViewModel,
    linkIcon,
    type MediaPreviewGroupEntry,
    type MediaPreviewGroupEntryContent,
    MediaPreviewEntryButton,
} from "@element-hq/web-shared-components";

import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import { TextualBodyViewModel } from "../../../viewmodels/room/timeline/event-tile/body/TextualBodyViewModel";
import { EventContentBodyViewModel } from "../../../viewmodels/message-body/EventContentBodyViewModel";
import { getParentEventId } from "../../../utils/Reply";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import PosthogTrackers from "../../../PosthogTrackers";
import ImageView from "../elements/ImageView";
import EditMessageComposer from "../rooms/EditMessageComposer";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";
import { UrlPreviewGroupViewModel } from "../../../viewmodels/message-body/UrlPreviewGroupViewModel";
import PlatformPeg from "../../../PlatformPeg";
import { useSettingValue } from "../../../hooks/useSettings";
import { MediaPreviewGroupViewModel } from "../../../viewmodels/message-body/MediaPreviewGroupViewModel";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import { remoteMediaForBundle } from "../../../modules/FileViewerApi";
import { ModuleApi } from "../../../modules/Api";
import { fileViewerOpenButton } from "../right_panel/FileViewerCard";

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
    const urlPreviewBundleEnabled = useSettingValue("feature_msc4095_url_preview_bundle");

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
                showTooltips: PlatformPeg.get()?.needsUrlTooltips() ?? true,
                urlPreviewBundleEnabled,
            }),
    );

    const { previews, totalPreviewCount, previewsLimited, overPreviewLimit } = useViewModel(urlPreviewVm);

    const collapse = overPreviewLimit
        ? {
              collapsed: previewsLimited,
              hiddenCount: totalPreviewCount - previews.length,
              onToggle: () => void urlPreviewVm.onTogglePreviewLimit(),
          }
        : undefined;

    const previewToEntry = (preview: UrlPreview): MediaPreviewGroupEntry => {
        let content: MediaPreviewGroupEntryContent;
        // file opening buttons will only apply to links with bundles
        const mediaHandle = preview.srcBundle && remoteMediaForBundle(preview.srcBundle);
        const fileViewers = mediaHandle ? ModuleApi.instance.fileViewer.getViewersFor(mediaHandle) : [];
        const fileViewerButtons: MediaPreviewEntryButton[] = mediaHandle
            ? fileViewers.map((viewer) => fileViewerOpenButton({ viewer, media: mediaHandle, mxEvent: props.mxEvent }))
            : [];

        if (preview.image === undefined) {
            content = {
                style: "text",
            };
        } else {
            content = {
                style: "image",
                image: preview.image.imageFull,
                imageSize: "banner",
                imageOnClick: () => {
                    Modal.createDialog(
                        ImageView,
                        {
                            src: preview.image!.imageFull, // full-res URL
                            name: `Thumbnail of ${preview.title}`,
                            width: preview.image?.width,
                            height: preview.image?.height,
                            fileSize: preview.image?.fileSize,
                        },
                        "mx_Dialog_lightbox",
                        undefined,
                        true,
                    );
                },
            };
        }

        let body: string;
        if (preview.description === undefined || preview.description.trim().length === 0) body = preview.siteName;
        else body = preview.description!;

        return {
            id: preview.link,
            header: preview.title,
            headerUrl: preview.link,
            body,
            buttons: [
                ...fileViewerButtons,
                {
                    label: _t("timeline|url_preview|open_link"),
                    icon: <PopOutIcon />,
                    onClick: async () => {
                        window.open(preview.link, "_blank", "noreferrer");
                    },
                },
            ],
            ...linkIcon(),
            ...content,
        };
    };

    const mediaPreviewVm = useCreateAutoDisposedViewModel(
        () =>
            new MediaPreviewGroupViewModel({
                entries: previews.map(previewToEntry),
            }),
    );

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
        void urlPreviewVm.updateUrlPreviewVisible(props.showUrlPreview ?? false).catch((error) => {
            logger.warn("UrlPreviewViewModel failed to updateUrlPreviewVisible", error);
        });
    }, [props.showUrlPreview, urlPreviewVm]);

    useEffect(() => {
        void urlPreviewVm.updateMediaVisible(mediaVisible).catch((error) => {
            logger.warn("UrlPreviewViewModel failed to updateMediaVisible", error);
        });
    }, [mediaVisible, urlPreviewVm]);

    useEffect(() => {
        mediaPreviewVm.replace({
            entries: previews.map(previewToEntry),
        });
    }, [previews, mediaPreviewVm]);

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
            urlPreviews={<MediaPreviewGroupPreview vm={mediaPreviewVm} collapse={collapse} />}
            className={getTextualBodyClassName(content.msgtype as MsgType | undefined)}
        />
    );
}
