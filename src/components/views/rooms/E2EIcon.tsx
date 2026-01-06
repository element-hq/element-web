/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps, type CSSProperties } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import { ErrorSolidIcon, ShieldIcon, LockSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

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
    status: E2EStatus;
    isUser?: boolean;
}

const icons: Record<E2EStatus, JSX.Element> = {
    [E2EStatus.Warning]: <ErrorSolidIcon color="var(--cpd-color-icon-critical-primary)" />,
    [E2EStatus.Normal]: <LockSolidIcon color="var(--cpd-color-icon-tertiary)" />,
    [E2EStatus.Verified]: <ShieldIcon color="var(--cpd-color-icon-success-primary)" />,
};

const E2EIcon: React.FC<Props> = ({ isUser, status, className, size, onClick, hideTooltip, tooltipPlacement }) => {
    const icon = icons[status];

    const classes = classNames("mx_E2EIcon", className);

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
        content = (
            <AccessibleButton onClick={onClick} className={classes} style={style} data-testid="e2e-icon">
                {icon}
            </AccessibleButton>
        );
    } else {
        content = (
            <div className={classes} style={style} data-testid="e2e-icon">
                {icon}
            </div>
        );
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
