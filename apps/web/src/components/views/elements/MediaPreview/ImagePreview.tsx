/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type CSSProperties } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import {
    RotateLeftIcon,
    RotateRightIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../AccessibleButton";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { normalizeWheelEvent } from "../../../../utils/Mouse";
import UIStore from "../../../../stores/UIStore";
import { presentableTextForFile } from "../../../../utils/FileUtils";
import MediaPreviewShell from "./MediaPreviewShell";

// Max scale to keep gaps around the image
const MAX_SCALE = 0.95;
// This is used for the buttons
const ZOOM_STEP = 0.1;
// This is used for mouse wheel events
const ZOOM_COEFFICIENT = 0.0025;
// If we have moved only this much we can zoom
const ZOOM_DISTANCE = 10;

// Height of mx_MediaPreview_panel
const getPanelHeight = (): number => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--media-preview-panel-height");
    // Return the value as a number without the unit
    return parseInt(value.slice(0, value.length - 2));
};

export interface ImagePreviewProps {
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
    onFinished: () => void;
}

interface IState {
    zoom: number;
    minZoom: number;
    maxZoom: number;
    rotation: number;
    translationX: number;
    translationY: number;
    moving: boolean;
}

/**
 * The image previewer: a pannable, zoomable, rotatable image inside the shared preview chrome.
 *
 * All of the gesture and zoom state below is local to this component — the shell knows nothing
 * about it, and contributes only the sender block, filename, download, message options and close.
 */
export default class ImagePreview extends React.Component<ImagePreviewProps, IState> {
    public constructor(props: ImagePreviewProps) {
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
        };
    }

    // XXX: Refs to functional components
    private focusLock = createRef<any>();
    private imageWrapper = createRef<HTMLDivElement>();
    private image = createRef<HTMLImageElement>();

    private initX = 0;
    private initY = 0;
    private previousX = 0;
    private previousY = 0;

    private animatingLoading = false;
    private imageIsLoaded = false;

    public componentDidMount(): void {
        // We have to use addEventListener() because the listener
        // needs to be passive in order to work with Chromium
        this.focusLock.current.addEventListener("wheel", this.onWheel, { passive: false });
        // We want to recalculate zoom whenever the window's size changes
        window.addEventListener("resize", this.recalculateZoom);
        // After the image loads for the first time we want to calculate the zoom
        this.image.current?.addEventListener("load", this.imageLoaded);
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

    private onRotateCounterClockwiseClick = (): void => {
        const cur = this.state.rotation;
        this.setZoomAndRotation(cur - 90);
    };

    private onRotateClockwiseClick = (): void => {
        const cur = this.state.rotation;
        this.setZoomAndRotation(cur + 90);
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

    public render(): React.ReactNode {
        let transitionClassName;
        if (this.animatingLoading) transitionClassName = "mx_ImagePreview_image_animatingLoading";
        else if (this.state.moving || !this.imageIsLoaded) transitionClassName = "";
        else transitionClassName = "mx_ImagePreview_image_animating";

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

        const content = this.props.mxEvent?.getContent<MediaEventContent>();
        const title = content ? presentableTextForFile(content, _t("common|image"), true) : undefined;

        const toolbar = (
            <>
                <AccessibleButton
                    className="mx_MediaPreview_button"
                    title={_t("action|zoom_out")}
                    onClick={this.onZoomOutClick}
                >
                    <ZoomOutIcon />
                </AccessibleButton>
                <AccessibleButton
                    className="mx_MediaPreview_button"
                    title={_t("action|zoom_in")}
                    onClick={this.onZoomInClick}
                >
                    <ZoomInIcon />
                </AccessibleButton>
                <AccessibleButton
                    className="mx_MediaPreview_button"
                    title={_t("lightbox|rotate_left")}
                    onClick={this.onRotateCounterClockwiseClick}
                >
                    <RotateLeftIcon />
                </AccessibleButton>
                <AccessibleButton
                    className="mx_MediaPreview_button"
                    title={_t("lightbox|rotate_right")}
                    onClick={this.onRotateClockwiseClick}
                >
                    <RotateRightIcon />
                </AccessibleButton>
            </>
        );

        return (
            <MediaPreviewShell
                label={_t("lightbox|title")}
                mxEvent={this.props.mxEvent}
                permalinkCreator={this.props.permalinkCreator}
                title={title}
                downloadUrl={this.props.src}
                downloadName={this.props.name}
                toolbar={toolbar}
                lockRef={this.focusLock}
                contentClassName="mx_ImagePreview_wrapper"
                contentRef={this.imageWrapper}
                contentProps={{
                    onMouseDown: this.props.onFinished,
                    onMouseMove: this.onMoving,
                    onMouseUp: this.onEndMoving,
                    onMouseLeave: this.onEndMoving,
                }}
                onFinished={this.props.onFinished}
            >
                <img
                    src={this.props.src}
                    style={style}
                    alt={this.props.name}
                    ref={this.image}
                    className={`mx_ImagePreview_image ${transitionClassName}`}
                    draggable={true}
                    onMouseDown={this.onStartMoving}
                />
            </MediaPreviewShell>
        );
    }
}
