/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, type CSSProperties, useEffect } from "react";
import FocusLock from "react-focus-lock";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    CloseIcon,
    DownloadIcon,
    OverflowHorizontalIcon,
    RotateLeftIcon,
    RotateRightIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { useCreateAutoDisposedViewModel, MessageTimestampView } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import { ContextMenuTooltipButton } from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import MessageContextMenu from "../context_menus/MessageContextMenu";
import { aboveLeftOf } from "../../structures/ContextMenu";
import SettingsStore from "../../../settings/SettingsStore";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { normalizeWheelEvent } from "../../../utils/Mouse";
import UIStore from "../../../stores/UIStore";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { presentableTextForFile } from "../../../utils/FileUtils";
import AccessibleButton from "./AccessibleButton";
import { useDownloadMedia } from "../../../hooks/useDownloadMedia.ts";
import {
    MessageTimestampViewModel,
    type MessageTimestampViewModelProps,
} from "../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel.ts";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { recogniseImage } from "../../../features/ai/InferenceClient";

// Max scale to keep gaps around the image
const MAX_SCALE = 0.95;
// This is used for the buttons
const ZOOM_STEP = 0.1;
// This is used for mouse wheel events
const ZOOM_COEFFICIENT = 0.0025;
// If we have moved only this much we can zoom
const ZOOM_DISTANCE = 10;
const ORIGINAL_LOAD_TIMEOUT_MS = 12_000;

// Height of mx_ImageView_panel
const getPanelHeight = (): number => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--image-view-panel-height");
    // Return the value as a number without the unit
    return parseInt(value.slice(0, value.length - 2));
};

interface IProps {
    src: string; // the source of the image being displayed
    name?: string; // the main title ('name') for the image
    link?: string; // the link (if any) applied to the name of the image
    width?: number; // width of the image src in pixels
    height?: number; // height of the image src in pixels
    fileSize?: number; // size of the image src in bytes
    /** A thumbnail already resolved by ImageBodyViewModel while the original preloads. */
    thumbnailSrc?: string;

    // the event (if any) that the Image is displaying. Used for event-specific stuff like
    // redactions, senders, timestamps etc.  Other descriptors are taken from the explicit
    // properties above, which let us use lightboxes to display images which aren't associated
    // with events.
    mxEvent?: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;

    thumbnailInfo?: {
        positionX: number;
        positionY: number;
        width: number;
        height: number;
    };
    onFinished(): void;
}

interface IState {
    zoom: number;
    minZoom: number;
    maxZoom: number;
    rotation: number;
    translationX: number;
    translationY: number;
    moving: boolean;
    contextMenuDisplayed: boolean;
    imageSrc: string;
    originalLoadFailed: boolean;
    windowOffsetX: number;
    windowOffsetY: number;
    movingWindow: boolean;
    ocrPanelOpen: boolean;
    ocrLoading: boolean;
    ocrText?: string;
    ocrError?: string;
}

/**
 * Keep the image viewer as a desktop-sized window, matching the Cinny/Spark
 * preview instead of turning every image into a full-screen lightbox.
 */
export function getImageViewerDialogClass(width?: number, height?: number): string {
    if (!width || !height) return "mx_Dialog_imageViewerWindow";

    const ratio = width / height;
    if (ratio < 0.85) return "mx_Dialog_imageViewerWindow mx_Dialog_imageViewerWindow_portrait";
    if (ratio <= 1.15) return "mx_Dialog_imageViewerWindow mx_Dialog_imageViewerWindow_square";
    return "mx_Dialog_imageViewerWindow mx_Dialog_imageViewerWindow_landscape";
}

export default class ImageView extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        const { thumbnailInfo } = this.props;

        let translationX = 0;
        let translationY = 0;
        if (thumbnailInfo) {
            translationX = thumbnailInfo.positionX + thumbnailInfo.width / 2 - UIStore.instance.windowWidth / 2;
            translationY =
                thumbnailInfo.positionY +
                thumbnailInfo.height / 2 -
                UIStore.instance.windowHeight / 2 -
                getPanelHeight() / 2;
        }

        this.state = {
            zoom: 0, // We default to 0 and override this in imageLoaded once we have naturalSize
            minZoom: MAX_SCALE,
            maxZoom: MAX_SCALE,
            rotation: 0,
            translationX,
            translationY,
            moving: false,
            contextMenuDisplayed: false,
            imageSrc: props.thumbnailSrc || props.src,
            originalLoadFailed: false,
            windowOffsetX: 0,
            windowOffsetY: 0,
            movingWindow: false,
            ocrPanelOpen: false,
            ocrLoading: false,
        };
    }

    // XXX: Refs to functional components
    private contextMenuButton = createRef<any>();
    private focusLock = createRef<any>();
    private imageWrapper = createRef<HTMLDivElement>();
    private image = createRef<HTMLImageElement>();

    private downloadFunction?: () => Promise<void>;

    private initX = 0;
    private initY = 0;
    private previousX = 0;
    private previousY = 0;

    private animatingLoading = false;
    private imageIsLoaded = false;
    private disposed = false;
    private originalLoadTimer?: ReturnType<typeof setTimeout>;
    private windowDragStartX = 0;
    private windowDragStartY = 0;
    private windowDragInitialX = 0;
    private windowDragInitialY = 0;

    public componentDidMount(): void {
        // We have to use addEventListener() because the listener
        // needs to be passive in order to work with Chromium
        this.focusLock.current.addEventListener("wheel", this.onWheel, { passive: false });
        // We want to recalculate zoom whenever the window's size changes
        window.addEventListener("resize", this.recalculateZoom);
        // After the image loads for the first time we want to calculate the zoom
        this.image.current?.addEventListener("load", this.imageLoaded);
        this.preloadOriginal();
    }

    public componentDidUpdate(): void {
        this.applyWindowOffset();
    }

    public componentWillUnmount(): void {
        this.disposed = true;
        this.focusLock.current.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("resize", this.recalculateZoom);
        this.image.current?.removeEventListener("load", this.imageLoaded);
        document.removeEventListener("mousemove", this.onWindowMoving);
        document.removeEventListener("mouseup", this.onWindowDragEnd);
        this.clearOriginalLoadTimer();
        this.clearWindowOffset();
    }

    /**
     * Modal.createDialog owns the outer dialog frame. Moving this component used
     * to leave that frame behind, so the user appeared to drag only the contents.
     * Apply the offset to the frame itself to make the whole preview window move.
     */
    private getDialogBorder = (): HTMLElement | null => this.focusLock.current?.closest?.(".mx_Dialog_border") ?? null;

    private applyWindowOffset = (): void => {
        const border = this.getDialogBorder();
        if (!border) return;
        const { windowOffsetX, windowOffsetY } = this.state;
        border.style.transform =
            windowOffsetX || windowOffsetY ? `translate3d(${windowOffsetX}px, ${windowOffsetY}px, 0)` : "";
    };

    private clearWindowOffset = (): void => {
        const border = this.getDialogBorder();
        if (border) border.style.transform = "";
    };

    private preloadOriginal = (): void => {
        if (this.props.src === this.state.imageSrc) return;
        this.clearOriginalLoadTimer();
        const original = new Image();
        original.onload = () => {
            this.clearOriginalLoadTimer();
            if (!this.disposed) this.setState({ imageSrc: this.props.src, originalLoadFailed: false });
        };
        original.onerror = () => {
            this.clearOriginalLoadTimer();
            if (!this.disposed) this.setState({ originalLoadFailed: true });
        };
        original.src = this.props.src;
        this.originalLoadTimer = setTimeout(() => {
            if (!this.disposed) this.setState({ originalLoadFailed: true });
        }, ORIGINAL_LOAD_TIMEOUT_MS);
    };

    private clearOriginalLoadTimer = (): void => {
        if (this.originalLoadTimer === undefined) return;
        clearTimeout(this.originalLoadTimer);
        this.originalLoadTimer = undefined;
    };

    private retryOriginal = (): void => {
        this.setState({ originalLoadFailed: false }, this.preloadOriginal);
    };

    private imageLoaded = (): void => {
        if (!this.image.current) return;
        // First, we calculate the zoom, so that the image has the same size as
        // the thumbnail
        const { thumbnailInfo } = this.props;
        if (thumbnailInfo?.width) {
            this.setState({ zoom: thumbnailInfo.width / this.image.current.naturalWidth });
        }

        // Once the zoom is set, we the image is considered loaded and we can
        // start animating it into the center of the screen
        this.imageIsLoaded = true;
        this.animatingLoading = true;
        this.setZoomAndRotation();
        this.setState({
            translationX: 0,
            translationY: 0,
        });

        // Once the position is set, there is no need to animate anymore
        this.animatingLoading = false;
    };

    private recalculateZoom = (): void => {
        this.setZoomAndRotation();
    };

    private setZoomAndRotation = (inputRotation?: number): void => {
        const image = this.image.current;
        const imageWrapper = this.imageWrapper.current;
        if (!image || !imageWrapper) return;

        const rotation = inputRotation ?? this.state.rotation;

        const imageIsNotFlipped = rotation % 180 === 0;

        // If the image is rotated take it into account
        const width = imageIsNotFlipped ? image.naturalWidth : image.naturalHeight;
        const height = imageIsNotFlipped ? image.naturalHeight : image.naturalWidth;

        const zoomX = imageWrapper.clientWidth / width;
        const zoomY = imageWrapper.clientHeight / height;

        // If the image is smaller in both dimensions set its the zoom to 1 to
        // display it in its original size
        if (zoomX >= 1 && zoomY >= 1) {
            this.setState({
                zoom: 1,
                minZoom: 1,
                maxZoom: 1,
                rotation: rotation,
            });
            return;
        }
        // We set minZoom to the min of the zoomX and zoomY to avoid overflow in
        // any direction. We also multiply by MAX_SCALE to get a gap around the
        // image by default
        const minZoom = Math.min(zoomX, zoomY) * MAX_SCALE;

        // If zoom is smaller than minZoom don't go below that value
        const zoom = this.state.zoom <= this.state.minZoom ? minZoom : this.state.zoom;

        this.setState({
            minZoom: minZoom,
            maxZoom: 1,
            rotation: rotation,
            zoom: zoom,
        });
    };

    private zoomDelta(delta: number, anchorX?: number, anchorY?: number): void {
        this.zoom(this.state.zoom + delta, anchorX, anchorY);
    }

    private zoom(zoomLevel: number, anchorX?: number, anchorY?: number): void {
        const oldZoom = this.state.zoom;
        // Spark's viewer allows inspecting small images beyond their natural
        // size too; keep a stable ceiling rather than locking them at 100%.
        const maxZoom = Math.max(4, this.state.maxZoom);
        const newZoom = Math.min(zoomLevel, maxZoom);
        if (newZoom <= this.state.minZoom) {
            // Zoom out fully
            this.setState({
                zoom: this.state.minZoom,
                translationX: 0,
                translationY: 0,
            });
        } else if (typeof anchorX !== "number" || typeof anchorY !== "number") {
            // Zoom relative to the center of the view
            this.setState({
                zoom: newZoom,
                translationX: (this.state.translationX * newZoom) / oldZoom,
                translationY: (this.state.translationY * newZoom) / oldZoom,
            });
        } else if (this.image.current) {
            // Zoom relative to the given point on the image.
            // First we need to figure out the offset of the anchor point
            // relative to the center of the image, accounting for rotation.
            let offsetX: number;
            let offsetY: number;
            // The modulo operator can return negative values for some
            // rotations, so we have to do some extra work to normalize it
            const rotation = (((this.state.rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
            switch (rotation) {
                case 0:
                    offsetX = this.image.current.clientWidth / 2 - anchorX;
                    offsetY = this.image.current.clientHeight / 2 - anchorY;
                    break;
                case 90:
                    offsetX = anchorY - this.image.current.clientHeight / 2;
                    offsetY = this.image.current.clientWidth / 2 - anchorX;
                    break;
                case 180:
                    offsetX = anchorX - this.image.current.clientWidth / 2;
                    offsetY = anchorY - this.image.current.clientHeight / 2;
                    break;
                case 270:
                    offsetX = this.image.current.clientHeight / 2 - anchorY;
                    offsetY = anchorX - this.image.current.clientWidth / 2;
            }

            // Apply the zoom and offset
            this.setState({
                zoom: newZoom,
                translationX: this.state.translationX + (newZoom - oldZoom) * offsetX,
                translationY: this.state.translationY + (newZoom - oldZoom) * offsetY,
            });
        }
    }

    private onWheel = (ev: WheelEvent): void => {
        if (ev.target === this.image.current) {
            ev.stopPropagation();
            ev.preventDefault();

            const { deltaY } = normalizeWheelEvent(ev);
            // Zoom in on the point on the image targeted by the cursor
            this.zoomDelta(-deltaY * ZOOM_COEFFICIENT, ev.offsetX, ev.offsetY);
        }
    };

    private onZoomInClick = (): void => {
        this.zoomDelta(ZOOM_STEP);
    };

    private onZoomOutClick = (): void => {
        this.zoomDelta(-ZOOM_STEP);
    };

    private onKeyDown = (ev: KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                this.props.onFinished();
                break;
            case KeyBindingAction.Save:
                ev.preventDefault();
                ev.stopPropagation();
                if (this.downloadFunction) {
                    this.downloadFunction();
                }
                break;
        }
    };

    private onRotateCounterClockwiseClick = (): void => {
        const cur = this.state.rotation;
        this.setZoomAndRotation(cur - 90);
    };

    private onRotateClockwiseClick = (): void => {
        const cur = this.state.rotation;
        this.setZoomAndRotation(cur + 90);
    };

    private onOpenContextMenu = (): void => {
        this.setState({
            contextMenuDisplayed: true,
        });
    };

    private onCloseContextMenu = (): void => {
        this.setState({
            contextMenuDisplayed: false,
        });
    };

    private onDownloadFunctionReady = (download: () => Promise<void>): void => {
        this.downloadFunction = download;
    };

    private onPermalinkClicked = (ev: React.MouseEvent): void => {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Element when clicked.
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: this.props.mxEvent?.getId(),
            highlighted: true,
            room_id: this.props.mxEvent?.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
        this.props.onFinished();
    };

    private onStartMoving = (ev: React.MouseEvent): void => {
        ev.stopPropagation();
        ev.preventDefault();

        // Don't do anything if we pressed any
        // other button than the left one
        if (ev.button !== 0) return;

        // Zoom in if we are completely zoomed out and increase the zoom factor for images
        // smaller than the viewport size
        if (this.state.zoom === this.state.minZoom) {
            this.zoom(
                this.state.maxZoom === this.state.minZoom ? 2 * this.state.maxZoom : this.state.maxZoom,
                ev.nativeEvent.offsetX,
                ev.nativeEvent.offsetY,
            );
            return;
        }

        this.setState({ moving: true });
        this.previousX = this.state.translationX;
        this.previousY = this.state.translationY;
        this.initX = ev.pageX - this.state.translationX;
        this.initY = ev.pageY - this.state.translationY;
    };

    private onMoving = (ev: React.MouseEvent): void => {
        ev.stopPropagation();
        ev.preventDefault();

        if (!this.state.moving) return;

        this.setState({
            translationX: ev.pageX - this.initX,
            translationY: ev.pageY - this.initY,
        });
    };

    private onEndMoving = (): void => {
        // Zoom out if we haven't moved much
        if (
            this.state.moving &&
            Math.abs(this.state.translationX - this.previousX) < ZOOM_DISTANCE &&
            Math.abs(this.state.translationY - this.previousY) < ZOOM_DISTANCE
        ) {
            this.zoom(this.state.minZoom);
            this.initX = 0;
            this.initY = 0;
        }
        this.setState({ moving: false });
    };

    private onWindowDragStart = (ev: React.MouseEvent<HTMLDivElement>): void => {
        if (ev.button !== 0) return;
        const target = ev.target as HTMLElement;
        // Controls in the title bar must remain clickable and must not start a drag.
        if (target.closest("button, a, .mx_Dialog_nonDialogButton")) return;

        this.windowDragStartX = ev.clientX;
        this.windowDragStartY = ev.clientY;
        this.windowDragInitialX = this.state.windowOffsetX;
        this.windowDragInitialY = this.state.windowOffsetY;
        this.setState({ movingWindow: true });
        document.addEventListener("mousemove", this.onWindowMoving);
        document.addEventListener("mouseup", this.onWindowDragEnd);
    };

    private onWindowMoving = (ev: MouseEvent): void => {
        const border = this.getDialogBorder();
        const maxX = border ? Math.max(0, (UIStore.instance.windowWidth - border.offsetWidth) / 2 - 16) : 0;
        const maxY = border ? Math.max(0, (UIStore.instance.windowHeight - border.offsetHeight) / 2 - 16) : 0;
        const offsetX = this.windowDragInitialX + ev.clientX - this.windowDragStartX;
        const offsetY = this.windowDragInitialY + ev.clientY - this.windowDragStartY;
        this.setState({
            windowOffsetX: Math.max(-maxX, Math.min(maxX, offsetX)),
            windowOffsetY: Math.max(-maxY, Math.min(maxY, offsetY)),
        });
    };

    private onWindowDragEnd = (): void => {
        document.removeEventListener("mousemove", this.onWindowMoving);
        document.removeEventListener("mouseup", this.onWindowDragEnd);
        this.setState({ movingWindow: false });
    };

    private onToggleOcrPanel = (): void => {
        if (!this.props.mxEvent) return;
        const open = !this.state.ocrPanelOpen;
        this.setState({ ocrPanelOpen: open });
        if (open && !this.state.ocrText && !this.state.ocrLoading) {
            void this.runOcr();
        }
    };

    private runOcr = async (): Promise<void> => {
        if (!this.props.mxEvent || this.state.ocrLoading) return;
        this.setState({ ocrPanelOpen: true, ocrLoading: true, ocrError: undefined });
        const helper = new MediaEventHelper(this.props.mxEvent);
        try {
            const ocrText = await recogniseImage(await helper.sourceBlob.value);
            if (!this.disposed) this.setState({ ocrText, ocrError: undefined });
        } catch (error) {
            if (!this.disposed) {
                this.setState({ ocrError: error instanceof Error ? error.message : "图片文字识别失败" });
            }
        } finally {
            helper.destroy();
            if (!this.disposed) this.setState({ ocrLoading: false });
        }
    };

    private onCopyOcrText = async (): Promise<void> => {
        if (!this.state.ocrText) return;
        await navigator.clipboard?.writeText(this.state.ocrText).catch(() => undefined);
    };

    private renderContextMenu(): JSX.Element {
        let contextMenu: JSX.Element | undefined;
        if (this.state.contextMenuDisplayed && this.props.mxEvent) {
            contextMenu = (
                <MessageContextMenu
                    {...aboveLeftOf(this.contextMenuButton.current.getBoundingClientRect())}
                    mxEvent={this.props.mxEvent}
                    permalinkCreator={this.props.permalinkCreator}
                    onFinished={this.onCloseContextMenu}
                    onCloseDialog={this.props.onFinished}
                />
            );
        }

        return <React.Fragment>{contextMenu}</React.Fragment>;
    }

    public render(): React.ReactNode {
        const showEventMeta = !!this.props.mxEvent;

        let transitionClassName;
        if (this.animatingLoading) transitionClassName = "mx_ImageView_image_animatingLoading";
        else if (this.state.moving || !this.imageIsLoaded) transitionClassName = "";
        else transitionClassName = "mx_ImageView_image_animating";

        const rotationDegrees = this.state.rotation + "deg";
        const zoom = this.state.zoom;
        const translatePixelsX = this.state.translationX + "px";
        const translatePixelsY = this.state.translationY + "px";
        // The order of the values is important!
        // First, we translate and only then we rotate, otherwise
        // we would apply the translation to an already rotated
        // image causing it translate in the wrong direction.
        const style: CSSProperties = {
            transform: `translateX(${translatePixelsX})
                        translateY(${translatePixelsY})
                        scale(${zoom})
                        rotate(${rotationDegrees})`,
        };

        if (this.state.moving) style.cursor = "grabbing";
        else if (this.state.zoom === this.state.minZoom) style.cursor = "zoom-in";
        else style.cursor = "zoom-out";

        let info: JSX.Element | undefined;
        if (showEventMeta) {
            const mxEvent = this.props.mxEvent;
            const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
            let permalink = "#";
            if (this.props.permalinkCreator) {
                permalink = this.props.permalinkCreator.forEvent(mxEvent.getId()!);
            }

            const senderName = mxEvent.sender?.name ?? mxEvent.getSender();
            const sender = <div className="mx_ImageView_info_sender">{senderName}</div>;
            const messageTimestamp = (
                <MessageTimestampWrapper
                    href={permalink}
                    onClick={this.onPermalinkClicked}
                    showFullDate={true}
                    showTwelveHour={showTwelveHour}
                    ts={mxEvent.getTs()}
                    showSeconds={false}
                    inhibitTooltip
                />
            );
            const avatar = (
                <MemberAvatar
                    member={mxEvent.sender}
                    fallbackUserId={mxEvent.getSender()}
                    size="32px"
                    viewUserOnClick={true}
                    className="mx_Dialog_nonDialogButton"
                />
            );

            info = (
                <div className="mx_ImageView_info_wrapper">
                    {avatar}
                    <div className="mx_ImageView_info">
                        {sender}
                        {messageTimestamp}
                    </div>
                </div>
            );
        } else {
            // If there is no event - we're viewing an avatar, we set
            // an empty div here, since the panel uses space-between
            // and we want the same placement of elements
            info = <div />;
        }

        let contextMenuButton: JSX.Element | undefined;
        if (this.props.mxEvent) {
            contextMenuButton = (
                <ContextMenuTooltipButton
                    className="mx_ImageView_button mx_ImageView_button_more"
                    title={_t("common|options")}
                    onClick={this.onOpenContextMenu}
                    ref={this.contextMenuButton}
                    isExpanded={this.state.contextMenuDisplayed}
                >
                    <OverflowHorizontalIcon />
                </ContextMenuTooltipButton>
            );
        }

        let title: JSX.Element | undefined;
        if (this.props.mxEvent?.getContent()) {
            title = (
                <div className="mx_ImageView_title">
                    {presentableTextForFile(this.props.mxEvent?.getContent(), _t("common|image"), true)}
                </div>
            );
        }

        return (
            <FocusLock
                returnFocus={true}
                lockProps={{
                    "onKeyDown": this.onKeyDown,
                    "role": "dialog",
                    "aria-label": _t("lightbox|title"),
                }}
                className="mx_ImageView"
                ref={this.focusLock}
            >
                <div
                    className="mx_ImageView_panel"
                    onMouseDown={this.onWindowDragStart}
                    data-dragging={this.state.movingWindow || undefined}
                >
                    {info}
                    {title}
                    <div className="mx_ImageView_toolbar">
                        <AccessibleButton
                            className="mx_ImageView_button"
                            title={_t("action|zoom_out")}
                            onClick={this.onZoomOutClick}
                        >
                            <ZoomOutIcon />
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_ImageView_button"
                            title={_t("action|zoom_in")}
                            onClick={this.onZoomInClick}
                        >
                            <ZoomInIcon />
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_ImageView_button"
                            title={_t("lightbox|rotate_left")}
                            onClick={this.onRotateCounterClockwiseClick}
                        >
                            <RotateLeftIcon />
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_ImageView_button"
                            title={_t("lightbox|rotate_right")}
                            onClick={this.onRotateClockwiseClick}
                        >
                            <RotateRightIcon />
                        </AccessibleButton>
                        {this.state.originalLoadFailed && (
                            <AccessibleButton
                                className="mx_ImageView_button"
                                title={_t("action|try_again")}
                                onClick={this.retryOriginal}
                            >
                                ↻
                            </AccessibleButton>
                        )}
                        {this.props.mxEvent && (
                            <AccessibleButton
                                className="mx_ImageView_button mx_ImageView_button_ocr"
                                title="识别文字"
                                onClick={this.onToggleOcrPanel}
                                disabled={this.state.ocrLoading}
                            >
                                OCR
                            </AccessibleButton>
                        )}
                        <DownloadButton
                            url={this.props.src}
                            fileName={this.props.name}
                            mxEvent={this.props.mxEvent}
                            onDownloadReady={this.onDownloadFunctionReady}
                        />
                        {contextMenuButton}
                        <AccessibleButton
                            className="mx_ImageView_button mx_ImageView_button_close"
                            title={_t("action|close")}
                            onClick={this.props.onFinished}
                        >
                            <CloseIcon />
                        </AccessibleButton>
                        {this.renderContextMenu()}
                    </div>
                </div>
                <div className="mx_ImageView_content" data-ocr-open={this.state.ocrPanelOpen || undefined}>
                    <div
                        className="mx_ImageView_image_wrapper"
                        ref={this.imageWrapper}
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) this.props.onFinished();
                        }}
                        onMouseMove={this.onMoving}
                        onMouseUp={this.onEndMoving}
                        onMouseLeave={this.onEndMoving}
                    >
                        <img
                            src={this.state.imageSrc}
                            style={style}
                            alt={this.props.name}
                            ref={this.image}
                            className={`mx_ImageView_image ${transitionClassName}`}
                            draggable={false}
                            onMouseDown={this.onStartMoving}
                            onDoubleClick={() => this.zoom(this.state.minZoom)}
                        />
                    </div>
                    {this.state.ocrPanelOpen && (
                        <aside className="mx_ImageView_ocrPanel" aria-live="polite">
                            <div className="mx_ImageView_ocrPanelHeader">
                                <strong>文字识别</strong>
                                <div>
                                    {this.state.ocrText && (
                                        <AccessibleButton
                                            className="mx_ImageView_ocrAction"
                                            onClick={this.onCopyOcrText}
                                        >
                                            复制
                                        </AccessibleButton>
                                    )}
                                    <AccessibleButton
                                        className="mx_ImageView_ocrAction"
                                        onClick={() => this.setState({ ocrPanelOpen: false })}
                                        title="关闭文字识别"
                                    >
                                        <CloseIcon />
                                    </AccessibleButton>
                                </div>
                            </div>
                            {this.state.ocrLoading && <p>正在识别图片中的文字…</p>}
                            {this.state.ocrError && (
                                <>
                                    <p>{this.state.ocrError}</p>
                                    <AccessibleButton className="mx_ImageView_ocrRetry" onClick={this.runOcr}>
                                        重新识别
                                    </AccessibleButton>
                                </>
                            )}
                            {this.state.ocrText && <pre className="mx_ImageView_ocrText">{this.state.ocrText}</pre>}
                        </aside>
                    )}
                </div>
            </FocusLock>
        );
    }
}

interface DownloadButtonProps {
    url: string;
    fileName?: string;
    mxEvent?: MatrixEvent;
    onDownloadReady?: (download: () => Promise<void>) => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ url, fileName, mxEvent, onDownloadReady }) => {
    const { download, loading, canDownload } = useDownloadMedia(url, fileName, mxEvent);

    useEffect(() => {
        if (onDownloadReady) onDownloadReady(download);
    }, [download, onDownloadReady]);

    if (!canDownload) return null;

    return (
        <AccessibleButton
            className="mx_ImageView_button"
            title={loading ? _t("timeline|download_action_downloading") : _t("action|download")}
            onClick={download}
            disabled={loading}
        >
            <DownloadIcon />
        </AccessibleButton>
    );
};

/**
 * Wraps MessageTimestampView with a view model synced to the provided props.
 * This wrapper can be removed after ImageView has been changed to a function component.
 */
function MessageTimestampWrapper(props: MessageTimestampViewModelProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new MessageTimestampViewModel(props));
    useEffect(() => {
        vm.setProps(props);
    }, [vm, props]);
    return <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />;
}
