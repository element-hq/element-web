/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React from "react";

import { sanitizedHtmlNode } from "../../../HtmlUtils";
import { _t } from "../../../languageHandler";
import AccessibleButton from "./AccessibleButton";

interface IProps {
    reason: string;
    htmlReason?: string;
}

interface IState {
    hidden: boolean;
}

export default class InviteReason extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            // We hide the reason for invitation by default, since it can be a
            // vector for spam/harassment.
            hidden: true,
        };
    }

    public onViewClick = (): void => {
        this.setState({
            hidden: false,
        });
    };

    public render(): React.ReactNode {
        const classes = classNames({
            mx_InviteReason: true,
            mx_InviteReason_hidden: this.state.hidden,
        });

        return (
            <div className={classes}>
                <div className="mx_InviteReason_reason">
                    {this.props.htmlReason ? sanitizedHtmlNode(this.props.htmlReason) : this.props.reason}
                </div>
                <AccessibleButton kind="link_inline" className="mx_InviteReason_view" onClick={this.onViewClick}>
                    {_t("common|view_message")}
                </AccessibleButton>
            </div>
        );
    }
}
