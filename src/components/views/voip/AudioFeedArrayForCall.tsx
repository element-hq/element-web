/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import AudioFeed from "./AudioFeed"
import { CallEvent, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";

interface IProps {
    call: MatrixCall;
}

interface IState {
    feeds: Array<CallFeed>;
    onHold: boolean;
}

export default class AudioFeedArrayForCall extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            feeds: [],
            onHold: false,
        };
    }

    componentDidMount() {
        this.props.call.addListener(CallEvent.FeedsChanged, this.onFeedsChanged);
        this.props.call.addListener(CallEvent.HoldUnhold, this.onHoldUnhold);
    }

    componentWillUnmount() {
        this.props.call.removeListener(CallEvent.FeedsChanged, this.onFeedsChanged);
        this.props.call.removeListener(CallEvent.HoldUnhold, this.onHoldUnhold);
    }

    onFeedsChanged = () => {
        this.setState({
            feeds: this.props.call.getRemoteFeeds(),
        });
    }

    onHoldUnhold = (onHold: boolean) => {
        this.setState({onHold: onHold});
    }

    render() {
        // If we are onHold don't render any audio elements
        if (this.state.onHold) return null;

        const feeds = this.state.feeds.map((feed, i) => {
            return (
                <AudioFeed feed={feed} key={i} />
            );
        });

        return feeds;
    }
}
