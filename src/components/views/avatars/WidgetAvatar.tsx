/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps } from "react";
import { IWidget } from "matrix-widget-api";
import classNames from "classnames";

import { IApp, isAppWidget } from "../../../stores/WidgetStore";
import BaseAvatar, { BaseAvatarType } from "./BaseAvatar";
import { mediaFromMxc } from "../../../customisations/Media";

interface IProps extends Omit<ComponentProps<BaseAvatarType>, "name" | "url" | "urls" | "height" | "width"> {
    app: IApp | IWidget;
    height?: number;
    width?: number;
}

const WidgetAvatar: React.FC<IProps> = ({ app, className, width = 20, height = 20, ...props }) => {
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

    return (
        <BaseAvatar
            {...props}
            name={app.id}
            className={classNames("mx_WidgetAvatar", className)}
            // MSC2765
            url={isAppWidget(app) && app.avatar_url ? mediaFromMxc(app.avatar_url).getSquareThumbnailHttp(20) : null}
            urls={iconUrls}
            width={width}
            height={height}
        />
    );
};

export default WidgetAvatar;
