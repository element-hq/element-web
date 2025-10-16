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

const MStickerBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent);

    const onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        if (!mediaVisible) {
            setVisible(true);
        }
    };

    // MStickerBody doesn't need a wrapping `<a href=...>`, but it does need extra padding
    // which is added by mx_MStickerBody_wrapper
    const wrapImage = (contentUrl: string | null | undefined, children: React.ReactNode): JSX.Element => {
        let onClickHandler: React.MouseEventHandler | undefined;
        if (!mediaVisible) {
            onClickHandler = onClick;
        }
        return (
            <div className="mx_MStickerBody_wrapper" onClick={onClickHandler}>
                {" "}
                {children}{" "}
            </div>
        );
    };

    // Placeholder to show in place of the sticker image if img onLoad hasn't fired yet.
    const getPlaceholder = (width: number, height: number): ReactNode => {
        if (props.mxEvent.getContent().info?.[BLURHASH_FIELD]) {
            // Use default blurhash placeholder
            return null;
        }
        return (
            <img
                aria-hidden
                alt=""
                className="mx_MStickerBody_placeholder"
                src={IconsShowStickersSvg}
                width="80"
                height="80"
            />
        );
    };

    // Tooltip to show on mouse over
    const getTooltipProps = (): ComponentProps<typeof Tooltip> | null => {
        const content = props.mxEvent && props.mxEvent.getContent();

        if (!content?.body || !content.info?.w) return null;

        return {
            placement: "right",
            description: content.body,
        };
    };

    // Don't show "Download this_file.png ..."
    const getFileBody = (): ReactNode => {
        return null;
    };

    const getBanner = (content: MediaEventContent): ReactNode => {
        return null; // we don't need a banner, we have a tooltip
    };

    return (
        <MImageBodyInner
            mediaVisible={mediaVisible}
            setMediaVisible={setVisible}
            onClick={onClick}
            wrapImage={wrapImage}
            getPlaceholder={getPlaceholder}
            getTooltipProps={getTooltipProps}
            getFileBody={getFileBody}
            getBanner={getBanner}
            {...props}
        />
    );
};

export default MStickerBody;
