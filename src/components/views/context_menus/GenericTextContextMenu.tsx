/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

interface IProps {
    message: string;
}

export default class GenericTextContextMenu extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <div className="mx_Tooltip mx_Tooltip_visible" style={{ display: "block" }}>
                {this.props.message}
            </div>
        );
    }
}
