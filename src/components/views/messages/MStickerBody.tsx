/*
Copyright 2018 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ReactNode } from "react";

import MImageBody from "./MImageBody";
import { BLURHASH_FIELD } from "../../../utils/image-media";
import Tooltip from "../elements/Tooltip";
import { IMediaEventContent } from "../../../customisations/models/IMediaEventContent";

export default class MStickerBody extends MImageBody {
    // Mostly empty to prevent default behaviour of MImageBody
    protected onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        if (!this.state.showImage) {
            this.showImage();
        }
    };

    // MStickerBody doesn't need a wrapping `<a href=...>`, but it does need extra padding
    // which is added by mx_MStickerBody_wrapper
    protected wrapImage(contentUrl: string, children: React.ReactNode): JSX.Element {
        let onClick: React.MouseEventHandler | undefined;
        if (!this.state.showImage) {
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
                src={require("../../../../res/img/icons-show-stickers.svg").default}
                width="80"
                height="80"
                onMouseEnter={this.onImageEnter}
                onMouseLeave={this.onImageLeave}
            />
        );
    }

    // Tooltip to show on mouse over
    protected getTooltip(): ReactNode {
        const content = this.props.mxEvent && this.props.mxEvent.getContent();

        if (!content || !content.body || !content.info || !content.info.w) return null;

        return (
            <div style={{ left: content.info.w + "px" }} className="mx_MStickerBody_tooltip">
                <Tooltip label={content.body} />
            </div>
        );
    }

    // Don't show "Download this_file.png ..."
    protected getFileBody(): ReactNode {
        return null;
    }

    protected getBanner(content: IMediaEventContent): ReactNode {
        return null; // we don't need a banner, we have a tooltip
    }
}
