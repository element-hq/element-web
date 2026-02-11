/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import { ErrorSolidIcon, InfoIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";

export enum InfoTooltipKind {
    Info = "info",
    Warning = "warning",
}

interface TooltipProps {
    tooltip?: string;
    className?: string;
    kind?: InfoTooltipKind;
    children?: ReactNode;
    tabIndex?: number;
}

export default class InfoTooltip extends React.PureComponent<TooltipProps> {
    public render(): React.ReactNode {
        const { tooltip, children, className, kind } = this.props;
        const title = _t("info_tooltip_title");

        // Tooltip are forced on the right for a more natural feel to them on info icons
        return (
            <Tooltip description={tooltip || title} placement="right">
                <div className={classNames("mx_InfoTooltip", className)} tabIndex={this.props.tabIndex ?? 0}>
                    <span className="mx_InfoTooltip_icon" aria-label={title}>
                        {kind !== InfoTooltipKind.Warning ? <InfoIcon /> : <ErrorSolidIcon />}
                    </span>
                    {children}
                </div>
            </Tooltip>
        );
    }
}
