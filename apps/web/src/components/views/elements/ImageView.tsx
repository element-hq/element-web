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
import { Button, Tooltip } from "@vector-im/compound-web";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
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

// Max scale to keep gaps around the image
const MAX_SCALE = 0.95;
// This is used for the buttons
const ZOOM_STEP = 0.1;
// This is used for mouse wheel events
const ZOOM_COEFFICIENT = 0.0025;
// If we have moved only this much we can zoom
const ZOOM_DISTANCE = 10;

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

    /**
     * Go to the previous (older) image. When set, a "Previous" button is shown next to the image and
     * the left arrow key navigates.
     */
    onPrev?(): void;
    /**
     * Go to the next (newer) image. When set, a "Next" button is shown next to the image and the
     * right arrow key navigates.
     */
    onNext?(): void;
    /**
     * Whether a previous/next navigation is in progress (e.g. older history is being fetched).
     * Disables the navigation buttons meanwhile.
     */
    navigationInProgress?: boolean;
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
        };
    }

    // XXX: Refs to functional components
    private contextMenuButton = createRef<any>();
    private focusLock = createRef<any>();
    private imageWrapper = createRef<HTMLDivElement>();
    private image = createRef<HTMLImageElement>();
    private prevButton = createRef<HTMLButtonElement>();
    private nextButton = createRef<HTMLButtonElement>();

    private downloadFunction?: () => Promise<void>;

    private initX = 0;
    private initY = 0;
    private previousX = 0;
    private previousY = 0;

    private animatingLoading = false;
    private imageIsLoaded = false;
    // Whether the first image has loaded; only that one animates in from its thumbnail.
    private hasLoadedOnce = false;

    public componentDidMount(): void {
        // We have to use addEventListener() because the listener
        // needs to be passive in order to work with Chromium
        this.focusLock.current.addEventListener("wheel", this.onWheel, { passive: false });
        // We want to recalculate zoom whenever the window's size changes
        window.addEventListener("resize", this.recalculateZoom);
        // After the image loads for the first time we want to calculate the zoom
        this.image.current?.addEventListener("load", this.imageLoaded);
    }

    public componentDidUpdate(prevProps: IProps): void {
        this.keepFocusAfterNavigationChange(prevProps);
        if (prevProps.src === this.props.src) return;

        // A new image is being shown (prev/next navigation): forget the zoom, rotation and panning
        // of the previous one. The zoom is recalculated once the new image has loaded.
        this.imageIsLoaded = false;
        this.animatingLoading = false;
        this.setState({
            zoom: 0,
            minZoom: MAX_SCALE,
            maxZoom: MAX_SCALE,
            rotation: 0,
            translationX: 0,
            translationY: 0,
            moving: false,
        });
    }

    public componentWillUnmount(): void {
        this.focusLock.current.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("resize", this.recalculateZoom);
        this.image.current?.removeEventListener("load", this.imageLoaded);
    }

    private imageLoaded = (): void => {
        if (!this.image.current) return;
        // First, we calculate the zoom, so that the image has the same size as
        // the thumbnail
        const { thumbnailInfo } = this.props;
        if (thumbnailInfo?.width && !this.hasLoadedOnce) {
            this.setState({ zoom: thumbnailInfo.width / this.image.current.naturalWidth });
        }
        this.hasLoadedOnce = true;

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
        const maxZoom = this.state.maxZoom === this.state.minZoom ? 2 * this.state.maxZoom : this.state.maxZoom;
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
            case KeyBindingAction.ArrowLeft:
            case KeyBindingAction.ArrowRight: {
                // Leave the arrow keys to the context menu while it is open
                if (this.state.contextMenuDisplayed || this.props.navigationInProgress) break;
                const navigate = action === KeyBindingAction.ArrowLeft ? this.props.onPrev : this.props.onNext;
                if (!navigate) break;
                ev.stopPropagation();
                ev.preventDefault();
                navigate();
                break;
            }
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                this.props.onFinished();
                break;
            case KeyBindingAction.Save:
                ev.preventDefault();
                ev.stopPropagation();
                if (this.downloadFunction) {
                    void this.downloadFunction();
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

    /**
     * When the focused previous/next button disappears (the start or end of the images was reached),
     * focus would fall out of the lightbox. Keep it inside so the keyboard keeps working.
     */
    private keepFocusAfterNavigationChange(prevProps: IProps): void {
        const lostPrev = !!prevProps.onPrev && !this.props.onPrev;
        const lostNext = !!prevProps.onNext && !this.props.onNext;
        if (!lostPrev && !lostNext) return;
        if (document.activeElement && document.activeElement !== document.body) return;

        const fallback = (lostNext ? this.prevButton.current : this.nextButton.current) ?? this.focusLock.current;
        fallback?.focus();
    }

    /**
     * The gutter on one side of the image holding the previous/next button. The gutter is always
     * rendered (even when its button is not) so the image stays centred.
     */
    private renderNavigation(direction: "prev" | "next"): JSX.Element {
        const onClick = direction === "prev" ? this.props.onPrev : this.props.onNext;
        const label = direction === "prev" ? _t("action|previous") : _t("action|next");
        const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;

        return (
            <div className={`mx_ImageView_nav mx_ImageView_nav_${direction} cpd-theme-dark`}>
                {onClick && (
                    <Tooltip label={label}>
                        <Button
                            ref={direction === "prev" ? this.prevButton : this.nextButton}
                            iconOnly
                            kind="secondary"
                            size="lg"
                            Icon={Icon}
                            aria-label={label}
                            onClick={onClick}
                            disabled={this.props.navigationInProgress}
                        />
                    </Tooltip>
                )}
            </div>
        );
    }

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
        const showNavigation = !!(this.props.onPrev || this.props.onNext);

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
                    "tabIndex": -1,
                }}
                className="mx_ImageView"
                ref={this.focusLock}
            >
                <div className="mx_ImageView_panel">
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
                <div className="mx_ImageView_content">
                    {showNavigation && this.renderNavigation("prev")}
                    <div
                        className="mx_ImageView_image_wrapper"
                        ref={this.imageWrapper}
                        onMouseDown={this.props.onFinished}
                        onMouseMove={this.onMoving}
                        onMouseUp={this.onEndMoving}
                        onMouseLeave={this.onEndMoving}
                    >
                        <img
                            src={this.props.src}
                            style={style}
                            alt={this.props.name}
                            ref={this.image}
                            className={`mx_ImageView_image ${transitionClassName}`}
                            draggable={true}
                            onMouseDown={this.onStartMoving}
                        />
                    </div>
                    {showNavigation && this.renderNavigation("next")}
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
