/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import FocusLock from "react-focus-lock";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CloseIcon,
    DownloadIcon,
    FileErrorIcon,
    OverflowHorizontalIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { useCreateAutoDisposedViewModel, MessageTimestampView } from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import MemberAvatar from "../../avatars/MemberAvatar";
import AccessibleButton from "../AccessibleButton";
import Spinner from "../Spinner";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import { ContextMenuTooltipButton } from "../../../../accessibility/context_menu/ContextMenuTooltipButton";
import { aboveLeftOf } from "../../../structures/ContextMenu";
import SettingsStore from "../../../../settings/SettingsStore";
import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { presentableTextForFile } from "../../../../utils/FileUtils";
import { MediaEventHelper } from "../../../../utils/MediaEventHelper";
import { useDownloadMedia } from "../../../../hooks/useDownloadMedia";
import {
    MessageTimestampViewModel,
    type MessageTimestampViewModelProps,
} from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";
import { FilePreviewKind, getFilePreviewKind } from "./previewTypes";
import { PdfPreview } from "./PdfPreview";
import { DocxPreview } from "./DocxPreview";

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const DEFAULT_ZOOM = 1;

interface Props {
    /** The `m.file` event being previewed. */
    mxEvent: MatrixEvent;
    /** Used to build the permalink behind the timestamp, when available. */
    permalinkCreator?: RoomPermalinkCreator;
    onFinished: () => void;
}

/**
 * A full-screen preview for document attachments, opened as a lightbox modal.
 *
 * The chrome deliberately mirrors {@link ImageView} — sender avatar and timestamp on the left,
 * filename in the middle, tools on the right — so that previewing a PDF feels the same as
 * previewing an image. Unlike images, the content itself is rendered by a per-format previewer
 * chosen from the event's mimetype.
 */
export default function FilePreviewDialog({ mxEvent, permalinkCreator, onFinished }: Props): JSX.Element {
    const content = mxEvent.getContent<MediaEventContent>();
    const kind = useMemo(() => getFilePreviewKind(content), [content]);

    const [data, setData] = useState<ArrayBuffer | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [contextMenuDisplayed, setContextMenuDisplayed] = useState(false);

    const contextMenuButton = useRef<any>(null);

    const mediaEventHelper = useMemo(() => new MediaEventHelper(mxEvent), [mxEvent]);
    useEffect(() => () => mediaEventHelper.destroy(), [mediaEventHelper]);

    // Fetch (and, for encrypted rooms, decrypt) the file up front. Both previewers work on
    // bytes rather than URLs, so there is no blob URL to leak into Element's origin.
    useEffect(() => {
        let cancelled = false;

        mediaEventHelper.sourceBlob.value
            .then((blob) => blob.arrayBuffer())
            .then((buffer) => {
                if (!cancelled) setData(buffer);
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error("Failed to fetch attachment for preview", err);
                setError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [mediaEventHelper]);

    const onLoaded = useCallback((count: number) => {
        setPageCount(count);
        setPage((current) => Math.min(current, count));
    }, []);

    const onPreviewError = useCallback((err: unknown) => setError(err), []);

    const onZoomIn = useCallback(() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)), []);
    const onZoomOut = useCallback(() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)), []);
    const onPreviousPage = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);
    const onNextPage = useCallback(() => setPage((p) => Math.min(p + 1, pageCount || p)), [pageCount]);

    const {
        download,
        loading: downloading,
        canDownload,
    } = useDownloadMedia(mediaEventHelper.media.srcHttp ?? "", mediaEventHelper.fileName, mxEvent);

    const isPaged = kind === FilePreviewKind.Pdf && pageCount > 1;

    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
            case KeyBindingAction.Save:
                ev.stopPropagation();
                ev.preventDefault();
                if (canDownload) void download();
                break;
            case KeyBindingAction.ArrowLeft:
                if (isPaged) {
                    ev.stopPropagation();
                    onPreviousPage();
                }
                break;
            case KeyBindingAction.ArrowRight:
                if (isPaged) {
                    ev.stopPropagation();
                    onNextPage();
                }
                break;
        }
    };

    const onPermalinkClicked = (ev: React.MouseEvent): void => {
        // Allow the permalink to be copied or opened in a new tab, while a plain click routes
        // within Element to the message itself.
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: mxEvent.getId(),
            highlighted: true,
            room_id: mxEvent.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
        onFinished();
    };

    let body: JSX.Element;
    if (error || kind === null) {
        body = (
            <div className="mx_FilePreviewDialog_error">
                <FileErrorIcon width="48px" height="48px" />
                <span>{_t("file_preview|error_unavailable")}</span>
            </div>
        );
    } else if (data === null) {
        body = <Spinner />;
    } else if (kind === FilePreviewKind.Pdf) {
        body = <PdfPreview data={data} page={page} zoom={zoom} onLoaded={onLoaded} onError={onPreviewError} />;
    } else {
        body = <DocxPreview data={data} zoom={zoom} onError={onPreviewError} />;
    }

    const permalink = permalinkCreator ? permalinkCreator.forEvent(mxEvent.getId()!) : "#";
    const senderName = mxEvent.sender?.name ?? mxEvent.getSender();

    return (
        <FocusLock
            returnFocus={true}
            lockProps={{
                "onKeyDown": onKeyDown,
                "role": "dialog",
                "aria-label": _t("file_preview|title"),
            }}
            className="mx_FilePreviewDialog"
        >
            <div className="mx_FilePreviewDialog_panel">
                <div className="mx_FilePreviewDialog_info_wrapper">
                    <MemberAvatar
                        member={mxEvent.sender}
                        fallbackUserId={mxEvent.getSender()}
                        size="32px"
                        viewUserOnClick={true}
                        className="mx_Dialog_nonDialogButton"
                    />
                    <div className="mx_FilePreviewDialog_info">
                        <div className="mx_FilePreviewDialog_info_sender">{senderName}</div>
                        <MessageTimestampWrapper
                            href={permalink}
                            onClick={onPermalinkClicked}
                            showFullDate={true}
                            showTwelveHour={SettingsStore.getValue("showTwelveHourTimestamps")}
                            ts={mxEvent.getTs()}
                            showSeconds={false}
                            inhibitTooltip
                        />
                    </div>
                </div>

                <div className="mx_FilePreviewDialog_title">
                    {presentableTextForFile(content, _t("common|attachment"), true)}
                </div>

                <div className="mx_FilePreviewDialog_toolbar">
                    {isPaged && (
                        <>
                            <AccessibleButton
                                className="mx_FilePreviewDialog_button"
                                title={_t("file_preview|previous_page")}
                                onClick={onPreviousPage}
                                disabled={page <= 1}
                            >
                                <ChevronLeftIcon />
                            </AccessibleButton>
                            <span className="mx_FilePreviewDialog_pageCount" aria-live="polite">
                                {_t("file_preview|page_of", { page, pageCount })}
                            </span>
                            <AccessibleButton
                                className="mx_FilePreviewDialog_button"
                                title={_t("file_preview|next_page")}
                                onClick={onNextPage}
                                disabled={page >= pageCount}
                            >
                                <ChevronRightIcon />
                            </AccessibleButton>
                        </>
                    )}
                    <AccessibleButton
                        className="mx_FilePreviewDialog_button"
                        title={_t("action|zoom_out")}
                        onClick={onZoomOut}
                        disabled={zoom <= MIN_ZOOM}
                    >
                        <ZoomOutIcon />
                    </AccessibleButton>
                    <AccessibleButton
                        className="mx_FilePreviewDialog_button"
                        title={_t("action|zoom_in")}
                        onClick={onZoomIn}
                        disabled={zoom >= MAX_ZOOM}
                    >
                        <ZoomInIcon />
                    </AccessibleButton>
                    {canDownload && (
                        <AccessibleButton
                            className="mx_FilePreviewDialog_button"
                            title={downloading ? _t("timeline|download_action_downloading") : _t("action|download")}
                            onClick={download}
                            disabled={downloading}
                        >
                            <DownloadIcon />
                        </AccessibleButton>
                    )}
                    <ContextMenuTooltipButton
                        className="mx_FilePreviewDialog_button mx_FilePreviewDialog_button_more"
                        title={_t("common|options")}
                        onClick={() => setContextMenuDisplayed(true)}
                        ref={contextMenuButton}
                        isExpanded={contextMenuDisplayed}
                    >
                        <OverflowHorizontalIcon />
                    </ContextMenuTooltipButton>
                    <AccessibleButton
                        className="mx_FilePreviewDialog_button mx_FilePreviewDialog_button_close"
                        title={_t("action|close")}
                        onClick={onFinished}
                    >
                        <CloseIcon />
                    </AccessibleButton>
                    {contextMenuDisplayed && contextMenuButton.current && (
                        <MessageContextMenu
                            {...aboveLeftOf(contextMenuButton.current.getBoundingClientRect())}
                            mxEvent={mxEvent}
                            permalinkCreator={permalinkCreator}
                            onFinished={() => setContextMenuDisplayed(false)}
                            onCloseDialog={onFinished}
                        />
                    )}
                </div>
            </div>

            <div className="mx_FilePreviewDialog_content">{body}</div>
        </FocusLock>
    );
}

/**
 * Wraps MessageTimestampView with a view model synced to the provided props.
 */
function MessageTimestampWrapper(props: MessageTimestampViewModelProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new MessageTimestampViewModel(props));
    useEffect(() => {
        vm.setProps(props);
    }, [vm, props]);
    return <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />;
}
