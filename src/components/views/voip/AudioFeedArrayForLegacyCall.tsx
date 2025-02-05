/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { CallEvent, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { type CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";

import AudioFeed from "./AudioFeed";

interface IProps {
    call: MatrixCall;
}

interface IState {
    feeds: Array<CallFeed>;
}

export default class AudioFeedArrayForLegacyCall extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            feeds: this.props.call.getRemoteFeeds(),
        };
    }

    public componentDidMount(): void {
        this.props.call.addListener(CallEvent.FeedsChanged, this.onFeedsChanged);
    }

    public componentWillUnmount(): void {
        this.props.call.removeListener(CallEvent.FeedsChanged, this.onFeedsChanged);
    }

    public onFeedsChanged = (): void => {
        this.setState({
            feeds: this.props.call.getRemoteFeeds(),
        });
    };

    public render(): JSX.Element[] {
        return this.state.feeds.map((feed, i) => {
            return <AudioFeed feed={feed} key={i} />;
        });
    }
}
