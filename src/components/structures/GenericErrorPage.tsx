/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

interface IProps {
    title: React.ReactNode;
    message: React.ReactNode;
}

export default class GenericErrorPage extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        return (
            <div className="mx_GenericErrorPage">
                <div className="mx_GenericErrorPage_box">
                    <h1>{this.props.title}</h1>
                    <p>{this.props.message}</p>
                </div>
            </div>
        );
    }
}
