/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes } from "react";
import { Tooltip } from "@vector-im/compound-web";

interface IProps extends HTMLAttributes<HTMLSpanElement> {
    tooltip: string;
    tooltipProps?: {
        tabIndex?: number;
    };
}

export default class TextWithTooltip extends React.Component<IProps> {
    public render(): React.ReactNode {
        const { className, children, tooltip, tooltipProps } = this.props;

        return (
            <Tooltip label={tooltip} placement="right">
                <span className={className} tabIndex={tooltipProps?.tabIndex ?? 0}>
                    {children}
                </span>
            </Tooltip>
        );
    }
}
