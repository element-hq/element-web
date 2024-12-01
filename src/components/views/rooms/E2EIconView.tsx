/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ComponentProps, CSSProperties } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";

import { _t, _td, TranslationKey } from "../../../languageHandler";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { XOR } from "../../../@types/common";
import { E2EState } from "./E2EIcon";

// export enum E2EState {
//     Verified = "verified",
//     Warning = "warning",
//     Normal = "normal",
// }

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

function getIconFromStatus(status: E2EState | E2EStatus): React.JSX.Element | undefined {
    switch (status) {
        case E2EState.Normal:
        case E2EStatus.Normal:
            return undefined;
        case E2EState.Verified:
        case E2EStatus.Verified:
            return <VerifiedIcon height="16px" width="16px" className="mx_E2EIconView_verified" />;
        case E2EState.Warning:
        case E2EStatus.Warning:
            return <ErrorIcon height="16px" width="16px" className="mx_E2EIconView_warning" />;
    }
}

interface Props {
    className?: string;
    size?: number;
    onClick?: () => void;
    tooltipPlacement?: ComponentProps<typeof Tooltip>["placement"];
}

interface UserPropsF extends Props {
    isUser: true;
    status: E2EState | E2EStatus;
}

interface RoomPropsF extends Props {
    isUser?: false;
    status: E2EStatus;
}

const E2EIcon: React.FC<XOR<UserPropsF, RoomPropsF>> = ({
    isUser,
    status,
    className,
    size,
    onClick,
    tooltipPlacement,
}) => {
    const classes = classNames(
        {
            mx_E2EIconView: true,
        },
        className,
    );

    let style: CSSProperties | undefined;
    if (size) {
        style = { width: `${size}px`, height: `${size}px` };
    }

    let e2eTitle: TranslationKey | undefined;
    if (isUser) {
        e2eTitle = crossSigningUserTitles[status];
    } else {
        e2eTitle = crossSigningRoomTitles[status];
    }
    const label = e2eTitle ? _t(e2eTitle) : "";

    const icon = getIconFromStatus(status);
    if (!icon) return null;

    return (
        <Tooltip label={label} placement={tooltipPlacement} isTriggerInteractive={!!onClick}>
            <div className={classes} style={style}>
                {icon}
            </div>
        </Tooltip>
    );
};

export default E2EIcon;
