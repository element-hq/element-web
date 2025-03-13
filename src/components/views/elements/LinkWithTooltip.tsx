/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import TextWithTooltip from "./TextWithTooltip";

interface IProps extends Omit<React.ComponentProps<typeof TextWithTooltip>, "tabIndex" | "onClick" | "tooltip"> {
    tooltip: string;
}

export default class LinkWithTooltip extends React.Component<IProps> {
    public render(): React.ReactNode {
        const { children, tooltip, ...props } = this.props;

        return (
            <TextWithTooltip
                // Disable focusing on the tooltip target to avoid double / nested focus. The contained anchor element
                // itself allows focusing which also triggers the tooltip.
                tabIndex={-1}
                tooltip={tooltip}
                onClick={(e) => (e.target as HTMLElement).blur()} // Force tooltip to hide on clickout
                {...props}
            >
                {children}
            </TextWithTooltip>
        );
    }
}
