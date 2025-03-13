/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps, type CSSProperties } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { _t, _td, type TranslationKey } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { E2EStatus } from "../../../utils/ShieldUtils";

export const crossSigningUserTitles: { [key in E2EStatus]?: TranslationKey } = {
    [E2EStatus.Warning]: _td("encryption|cross_signing_user_warning"),
    [E2EStatus.Normal]: _td("encryption|cross_signing_user_normal"),
    [E2EStatus.Verified]: _td("encryption|cross_signing_user_verified"),
};
const crossSigningRoomTitles: { [key in E2EStatus]?: TranslationKey } = {
    [E2EStatus.Warning]: _td("encryption|cross_signing_room_warning"),
    [E2EStatus.Normal]: _td("encryption|cross_signing_room_normal"),
    [E2EStatus.Verified]: _td("encryption|cross_signing_room_verified"),
};

interface Props {
    className?: string;
    size?: number;
    onClick?: () => void;
    hideTooltip?: boolean;
    tooltipPlacement?: ComponentProps<typeof Tooltip>["placement"];
    bordered?: boolean;
    status: E2EStatus;
    isUser?: boolean;
}

const E2EIcon: React.FC<Props> = ({
    isUser,
    status,
    className,
    size,
    onClick,
    hideTooltip,
    tooltipPlacement,
    bordered,
}) => {
    const classes = classNames(
        {
            mx_E2EIcon: true,
            mx_E2EIcon_bordered: bordered,
            mx_E2EIcon_warning: status === E2EStatus.Warning,
            mx_E2EIcon_normal: status === E2EStatus.Normal,
            mx_E2EIcon_verified: status === E2EStatus.Verified,
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
        <Tooltip label={label} placement={tooltipPlacement} isTriggerInteractive={!!onClick}>
            {content}
        </Tooltip>
    );
};

export default E2EIcon;
