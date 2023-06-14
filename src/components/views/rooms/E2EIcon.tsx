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

import React, { CSSProperties, useState } from "react";
import classNames from "classnames";

import { _t, _td } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Tooltip, { Alignment } from "../elements/Tooltip";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { XOR } from "../../../@types/common";

export enum E2EState {
    Verified = "verified",
    Warning = "warning",
    Unknown = "unknown",
    Normal = "normal",
    Unauthenticated = "unauthenticated",
}

const crossSigningUserTitles: { [key in E2EState]?: string } = {
    [E2EState.Warning]: _td("This user has not verified all of their sessions."),
    [E2EState.Normal]: _td("You have not verified this user."),
    [E2EState.Verified]: _td("You have verified this user. This user has verified all of their sessions."),
};
const crossSigningRoomTitles: { [key in E2EState]?: string } = {
    [E2EState.Warning]: _td("Someone is using an unknown session"),
    [E2EState.Normal]: _td("This room is end-to-end encrypted"),
    [E2EState.Verified]: _td("Everyone in this room is verified"),
};

interface Props {
    className?: string;
    size?: number;
    onClick?: () => void;
    hideTooltip?: boolean;
    tooltipAlignment?: Alignment;
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
    tooltipAlignment,
    bordered,
}) => {
    const [hover, setHover] = useState(false);

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

    let e2eTitle: string | undefined;
    if (isUser) {
        e2eTitle = crossSigningUserTitles[status];
    } else {
        e2eTitle = crossSigningRoomTitles[status];
    }

    let style: CSSProperties | undefined;
    if (size) {
        style = { width: `${size}px`, height: `${size}px` };
    }

    const onMouseOver = (): void => setHover(true);
    const onMouseLeave = (): void => setHover(false);

    const label = e2eTitle ? _t(e2eTitle) : "";

    let tip: JSX.Element | undefined;
    if (hover && !hideTooltip && label) {
        tip = <Tooltip label={label} alignment={tooltipAlignment} />;
    }

    if (onClick) {
        return (
            <AccessibleButton
                onClick={onClick}
                onMouseOver={onMouseOver}
                onMouseLeave={onMouseLeave}
                className={classes}
                style={style}
                aria-label={label}
            >
                {tip}
            </AccessibleButton>
        );
    }

    return (
        <div onMouseOver={onMouseOver} onMouseLeave={onMouseLeave} className={classes} style={style} aria-label={label}>
            {tip}
        </div>
    );
};

export default E2EIcon;
