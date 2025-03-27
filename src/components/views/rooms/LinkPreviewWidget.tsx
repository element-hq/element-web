/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps, createRef, type ReactNode } from "react";
import { decode } from "html-entities";
import { type MatrixEvent, type IPreviewUrlResponse } from "matrix-js-sdk/src/matrix";

import { Linkify } from "../../../HtmlUtils";
import SettingsStore from "../../../settings/SettingsStore";
import Modal from "../../../Modal";
import * as ImageUtils from "../../../ImageUtils";
import { mediaFromMxc } from "../../../customisations/Media";
import ImageView from "../elements/ImageView";
import LinkWithTooltip from "../elements/LinkWithTooltip";
import PlatformPeg from "../../../PlatformPeg";

interface IProps {
    link: string;
    preview: IPreviewUrlResponse;
    mxEvent: MatrixEvent; // the Event associated with the preview
    children?: ReactNode;
}

export default class LinkPreviewWidget extends React.Component<IProps> {
    private image = createRef<HTMLImageElement>();

    private onImageClick = (ev: React.MouseEvent): void => {
        const p = this.props.preview;
        if (ev.button != 0 || ev.metaKey) return;
        ev.preventDefault();

        let src: string | null | undefined = p["og:image"];
        if (src?.startsWith("mxc://")) {
            src = mediaFromMxc(src).srcHttp;
        }

        if (!src) return;

        const params: Omit<ComponentProps<typeof ImageView>, "onFinished"> = {
            src: src,
            width: p["og:image:width"],
            height: p["og:image:height"],
            name: p["og:title"] || p["og:description"] || this.props.link,
            fileSize: p["matrix:image:size"],
            link: this.props.link,
        };

        if (this.image.current) {
            const clientRect = this.image.current.getBoundingClientRect();

            params.thumbnailInfo = {
                width: clientRect.width,
                height: clientRect.height,
                positionX: clientRect.x,
                positionY: clientRect.y,
            };
        }

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    };

    public render(): React.ReactNode {
        const p = this.props.preview;

        // FIXME: do we want to factor out all image displaying between this and MImageBody - especially for lightboxing?
        let image: string | null = p["og:image"] ?? null;
        if (!SettingsStore.getValue("showImages")) {
            image = null; // Don't render a button to show the image, just hide it outright
        }
        const imageMaxWidth = 100;
        const imageMaxHeight = 100;
        if (image && image.startsWith("mxc://")) {
            // We deliberately don't want a square here, so use the source HTTP thumbnail function
            image = mediaFromMxc(image).getThumbnailOfSourceHttp(imageMaxWidth, imageMaxHeight, "scale");
        }

        const thumbHeight =
            ImageUtils.thumbHeight(p["og:image:width"], p["og:image:height"], imageMaxWidth, imageMaxHeight) ??
            imageMaxHeight;

        let img: JSX.Element | undefined;
        if (image) {
            img = (
                <div className="mx_LinkPreviewWidget_image" style={{ height: thumbHeight }}>
                    <img
                        ref={this.image}
                        style={{ maxWidth: imageMaxWidth, maxHeight: imageMaxHeight }}
                        src={image}
                        onClick={this.onImageClick}
                        alt=""
                    />
                </div>
            );
        }

        // The description includes &-encoded HTML entities, we decode those as React treats the thing as an
        // opaque string. This does not allow any HTML to be injected into the DOM.
        const description = decode(p["og:description"] || "");

        const title = p["og:title"]?.trim() ?? "";
        const anchor = (
            <a href={this.props.link} target="_blank" rel="noreferrer noopener">
                {title}
            </a>
        );
        const needsTooltip = PlatformPeg.get()?.needsUrlTooltips() && this.props.link !== title;

        return (
            <div className="mx_LinkPreviewWidget">
                <div className="mx_LinkPreviewWidget_wrapImageCaption">
                    {img}
                    <div className="mx_LinkPreviewWidget_caption">
                        <div className="mx_LinkPreviewWidget_title">
                            {needsTooltip ? (
                                <LinkWithTooltip tooltip={new URL(this.props.link, window.location.href).toString()}>
                                    {anchor}
                                </LinkWithTooltip>
                            ) : (
                                anchor
                            )}
                            {p["og:site_name"] && (
                                <span className="mx_LinkPreviewWidget_siteName">{" - " + p["og:site_name"]}</span>
                            )}
                        </div>
                        <div className="mx_LinkPreviewWidget_description">
                            <Linkify>{description}</Linkify>
                        </div>
                    </div>
                </div>
                {this.props.children}
            </div>
        );
    }
}
