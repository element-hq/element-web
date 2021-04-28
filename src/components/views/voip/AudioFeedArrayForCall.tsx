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
}

export default class AudioFeedArrayForCall extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            feeds: [],
        };
    }

    componentDidMount() {
        this.props.call.addListener(CallEvent.FeedsChanged, this.onFeedsChanged);
    }

    componentWillUnmount() {
        this.props.call.removeListener(CallEvent.FeedsChanged, this.onFeedsChanged);
    }

    onFeedsChanged = () => {
        this.setState({
            feeds: this.props.call.getRemoteFeeds(),
        });
    }

    render() {
        return this.state.feeds.map((feed, i) => {
            return (
                <AudioFeed feed={feed} key={i} />
            );
        });
    }
}
