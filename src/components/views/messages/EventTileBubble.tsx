/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, type Ref } from "react";
import classNames from "classnames";

interface IProps {
    className: string;
    title: string;
    timestamp?: JSX.Element;
    subtitle?: ReactNode;
    children?: JSX.Element;
    ref?: Ref<HTMLDivElement>;
}

const EventTileBubble = ({ className, title, timestamp, subtitle, children, ref }: IProps): JSX.Element => {
    return (
        <div className={classNames("mx_EventTileBubble", className)} ref={ref}>
            <div className="mx_EventTileBubble_title">{title}</div>
            {subtitle && <div className="mx_EventTileBubble_subtitle">{subtitle}</div>}
            {children}
            {timestamp}
        </div>
    );
};

export default EventTileBubble;
