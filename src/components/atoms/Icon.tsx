/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";

import liveIcon from "../../../res/img/element-icons/live.svg";

export enum IconType {
    Live,
}

const iconTypeMap = new Map([
    [IconType.Live, liveIcon],
]);

export enum IconColour {
    Accent = "accent",
    LiveBadge = "live-badge",
}

export enum IconSize {
    S16 = "16",
}

interface IconProps {
    colour?: IconColour;
    size?: IconSize;
    type: IconType;
}

export const Icon: React.FC<IconProps> = ({
    size = IconSize.S16,
    colour = IconColour.Accent,
    type,
    ...rest
}) => {
    const classes = [
        "mx_Icon",
        `mx_Icon_${size}`,
        `mx_Icon_${colour}`,
    ];

    const styles: React.CSSProperties = {
        maskImage: `url("${iconTypeMap.get(type)}")`,
    };

    return (
        <i
            aria-hidden
            className={classes.join(" ")}
            role="presentation"
            style={styles}
            {...rest}
        />
    );
};
