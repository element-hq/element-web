/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps, type ReactNode } from "react";
import { type Tooltip } from "@vector-im/compound-web";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { MImageBodyInner } from "./MImageBody";
import { BLURHASH_FIELD } from "../../../utils/image-media";
import IconsShowStickersSvg from "../../../../res/img/icons-show-stickers.svg";
import { type IBodyProps } from "./IBodyProps";
import { useMediaVisible } from "../../../hooks/useMediaVisible";

class MStickerBodyInner extends MImageBodyInner {
    // Mostly empty to prevent default behaviour of MImageBody
    protected onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        if (!this.props.mediaVisible) {
            this.props.setMediaVisible?.(true);
        }
    };

    // MStickerBody doesn't need a wrapping `<a href=...>`, but it does need extra padding
    // which is added by mx_MStickerBody_wrapper
    protected wrapImage(contentUrl: string, children: React.ReactNode): JSX.Element {
        let onClick: React.MouseEventHandler | undefined;
        if (!this.props.mediaVisible) {
            onClick = this.onClick;
        }
        return (
            <div className="mx_MStickerBody_wrapper" onClick={onClick}>
                {" "}
                {children}{" "}
            </div>
        );
    }

    // Placeholder to show in place of the sticker image if img onLoad hasn't fired yet.
    protected getPlaceholder(width: number, height: number): ReactNode {
        if (this.props.mxEvent.getContent().info?.[BLURHASH_FIELD]) return super.getPlaceholder(width, height);
        return (
            <img
                aria-hidden
                alt=""
                className="mx_MStickerBody_placeholder"
                src={IconsShowStickersSvg}
                width="80"
                height="80"
                onMouseEnter={this.onImageEnter}
                onMouseLeave={this.onImageLeave}
            />
        );
    }

    // Tooltip to show on mouse over
    protected getTooltipProps(): ComponentProps<typeof Tooltip> | null {
        const content = this.props.mxEvent && this.props.mxEvent.getContent();

        if (!content?.body || !content.info?.w) return null;

        return {
            placement: "right",
            description: content.body,
        };
    }

    // Don't show "Download this_file.png ..."
    protected getFileBody(): ReactNode {
        return null;
    }

    protected getBanner(content: MediaEventContent): ReactNode {
        return null; // we don't need a banner, we have a tooltip
    }
}

const MStickerBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent.getId()!);
    return <MStickerBodyInner mediaVisible={mediaVisible} setMediaVisible={setVisible} {...props} />;
};

export default MStickerBody;
