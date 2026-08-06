/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { type IWidget } from "matrix-widget-api";
import classNames from "classnames";

import { type IApp, isAppWidget } from "../../../stores/WidgetStore";
import BaseAvatar, { type BaseAvatarType } from "./BaseAvatar";
import { mediaFromMxc } from "../../../customisations/Media";
import DefaultAppSvg from "../../../../res/img/element-icons/room/default_app.svg";
import DefaultVideoSvg from "../../../../res/img/element-icons/room/default_video.svg";
import DefaultCalSvg from "../../../../res/img/element-icons/room/default_cal.svg";
import DefaultDocSvg from "../../../../res/img/element-icons/room/default_doc.svg";
import DefaultClockSvg from "../../../../res/img/element-icons/room/default_clock.svg";

interface IProps extends Omit<ComponentProps<BaseAvatarType>, "name" | "url" | "urls"> {
    app: IApp | IWidget;
    size: string;
}

const WidgetAvatar: React.FC<IProps> = ({ app, className, size = "20px", ...props }) => {
    let iconUrl = DefaultAppSvg;
    // heuristics for some better icons until Widgets support their own icons
    if (app.type.includes("jitsi")) {
        iconUrl = DefaultVideoSvg;
    } else if (app.type.includes("meeting") || app.type.includes("calendar")) {
        iconUrl = DefaultCalSvg;
    } else if (app.type.includes("pad") || app.type.includes("doc") || app.type.includes("calc")) {
        iconUrl = DefaultDocSvg;
    } else if (app.type.includes("clock")) {
        iconUrl = DefaultClockSvg;
    }

    return (
        <BaseAvatar
            {...props}
            // Span elements cannot have a label
            role="img"
            name={app.id}
            className={classNames("mx_WidgetAvatar", className)}
            // MSC2765
            url={isAppWidget(app) && app.avatar_url ? mediaFromMxc(app.avatar_url).getSquareThumbnailHttp(20) : null}
            urls={[iconUrl]}
            size={size}
        />
    );
};

export default WidgetAvatar;
