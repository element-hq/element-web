/*
Copyright 2019 New Vector Ltd
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

import React, { ComponentProps, CSSProperties } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { _t, _td, TranslationKey } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { XOR } from "../../../@types/common";

export enum E2EState {
    Verified = "verified",
    Warning = "warning",
    Unknown = "unknown",
    Normal = "normal",
    Unauthenticated = "unauthenticated",
}

const crossSigningUserTitles: { [key in E2EState]?: TranslationKey } = {
    [E2EState.Warning]: _td("encryption|cross_signing_user_warning"),
    [E2EState.Normal]: _td("encryption|cross_signing_user_normal"),
    [E2EState.Verified]: _td("encryption|cross_signing_user_verified"),
};
const crossSigningRoomTitles: { [key in E2EState]?: TranslationKey } = {
    [E2EState.Warning]: _td("encryption|cross_signing_room_warning"),
    [E2EState.Normal]: _td("encryption|cross_signing_room_normal"),
    [E2EState.Verified]: _td("encryption|cross_signing_room_verified"),
};

interface Props {
    className?: string;
    size?: number;
    onClick?: () => void;
    hideTooltip?: boolean;
    tooltipSide?: ComponentProps<typeof Tooltip>["side"];
    bordered?: boolean;
}

interface UserProps extends Props {
    isUser: true;
    status: E2EState | E2EStatus;
}

interface RoomProps extends Props {
    isUser?: false;
    status: E2EStatus;
}

const E2EIcon: React.FC<XOR<UserProps, RoomProps>> = ({
    isUser,
    status,
    className,
    size,
    onClick,
    hideTooltip,
    tooltipSide,
    bordered,
}) => {
    const classes = classNames(
        {
            mx_E2EIcon: true,
            mx_E2EIcon_bordered: bordered,
            mx_E2EIcon_warning: status === E2EState.Warning,
            mx_E2EIcon_normal: status === E2EState.Normal,
            mx_E2EIcon_verified: status === E2EState.Verified,
        },
        className,
    );

    let e2eTitle: TranslationKey | undefined;
    if (isUser) {
        e2eTitle = crossSigningUserTitles[status];
    } else {
        e2eTitle = crossSigningRoomTitles[status];
    }

    let style: CSSProperties | undefined;
    if (size) {
        style = { width: `${size}px`, height: `${size}px` };
    }

    const label = e2eTitle ? _t(e2eTitle) : "";

    let content: JSX.Element;
    if (onClick) {
        content = <AccessibleButton onClick={onClick} className={classes} style={style} />;
    } else {
        content = <div className={classes} style={style} />;
    }

    if (!e2eTitle || hideTooltip) {
        return content;
    }

    return (
        <Tooltip label={label} side={tooltipSide} isTriggerInteractive={!!onClick}>
            {content}
        </Tooltip>
    );
};

export default E2EIcon;
