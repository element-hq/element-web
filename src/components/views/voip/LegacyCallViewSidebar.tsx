/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { type CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";
import classNames from "classnames";

import VideoFeed from "./VideoFeed";

interface IProps {
    feeds: Array<CallFeed>;
    call: MatrixCall;
    pipMode: boolean;
}

export default class LegacyCallViewSidebar extends React.Component<IProps> {
    public render(): React.ReactNode {
        const feeds = this.props.feeds.map((feed) => {
            return (
                <VideoFeed
                    key={feed.stream.id}
                    feed={feed}
                    call={this.props.call}
                    primary={false}
                    pipMode={this.props.pipMode}
                />
            );
        });

        const className = classNames("mx_LegacyCallViewSidebar", {
            mx_LegacyCallViewSidebar_pipMode: this.props.pipMode,
        });

        return <div className={className}>{feeds}</div>;
    }
}
