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

interface IProps extends Omit<ComponentProps<BaseAvatarType>, "name" | "url" | "urls"> {
    app: IApp | IWidget;
    size: string;
}

const WidgetAvatar: React.FC<IProps> = ({ app, className, size = "20px", ...props }) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    let iconUrls = [require("../../../../res/img/element-icons/room/default_app.svg").default];
    // heuristics for some better icons until Widgets support their own icons
    if (app.type.includes("jitsi")) {
        iconUrls = [require("../../../../res/img/element-icons/room/default_video.svg").default];
    } else if (app.type.includes("meeting") || app.type.includes("calendar")) {
        iconUrls = [require("../../../../res/img/element-icons/room/default_cal.svg").default];
    } else if (app.type.includes("pad") || app.type.includes("doc") || app.type.includes("calc")) {
        iconUrls = [require("../../../../res/img/element-icons/room/default_doc.svg").default];
    } else if (app.type.includes("clock")) {
        iconUrls = [require("../../../../res/img/element-icons/room/default_clock.svg").default];
    }
    /* eslint-enable @typescript-eslint/no-require-imports */

    return (
        <BaseAvatar
            {...props}
            name={app.id}
            className={classNames("mx_WidgetAvatar", className)}
            // MSC2765
            url={isAppWidget(app) && app.avatar_url ? mediaFromMxc(app.avatar_url).getSquareThumbnailHttp(20) : null}
            urls={iconUrls}
            size={size}
        />
    );
};

export default WidgetAvatar;
