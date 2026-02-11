/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Sorunome

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode } from "react";

interface IProps {
    reason?: string;
    children: ReactNode;
}

interface IState {
    visible: boolean;
}

export default class Spoiler extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            visible: false,
        };
    }

    private toggleVisible = (e: React.MouseEvent): void => {
        if (!this.state.visible) {
            // we are un-blurring, we don't want this click to propagate to potential child pills
            e.preventDefault();
            e.stopPropagation();
        }
        this.setState({ visible: !this.state.visible });
    };

    public render(): React.ReactNode {
        const reason = this.props.reason ? (
            <span className="mx_EventTile_spoiler_reason">{"(" + this.props.reason + ")"}</span>
        ) : null;
        return (
            <button
                className={"mx_EventTile_spoiler" + (this.state.visible ? " visible" : "")}
                onClick={this.toggleVisible}
            >
                {reason}
                &nbsp;
                <span className="mx_EventTile_spoiler_content">{this.props.children}</span>
            </button>
        );
    }
}
