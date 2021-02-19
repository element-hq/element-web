/*
Copyright 2015, 2016, 2019 The Matrix.org Foundation C.I.C.

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

import classnames from 'classnames';
import { MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import React, {createRef} from 'react';
import SettingsStore from "../../../settings/SettingsStore";

export enum VideoFeedType {
    Local,
    Remote,
}

interface IProps {
    call: MatrixCall,

    type: VideoFeedType,

    // maxHeight style attribute for the video element
    maxHeight?: number,

    // a callback which is called when the video element is resized
    // due to a change in video metadata
    onResize?: (e: Event) => void,
}

export default class VideoFeed extends React.Component<IProps> {
    private vid = createRef<HTMLVideoElement>();

    componentDidMount() {
        this.vid.current.addEventListener('resize', this.onResize);
        this.setVideoElement();
    }

    componentDidUpdate(prevProps) {
        if (this.props.call !== prevProps.call) {
            this.setVideoElement();
        }
    }

    componentWillUnmount() {
        this.vid.current.removeEventListener('resize', this.onResize);
    }

    private setVideoElement() {
        if (this.props.type === VideoFeedType.Local) {
            this.props.call.setLocalVideoElement(this.vid.current);
        } else {
            this.props.call.setRemoteVideoElement(this.vid.current);
        }
    }

    onResize = (e) => {
        if (this.props.onResize) {
            this.props.onResize(e);
        }
    };

    render() {
        const videoClasses = {
            mx_VideoFeed: true,
            mx_VideoFeed_local: this.props.type === VideoFeedType.Local,
            mx_VideoFeed_remote: this.props.type === VideoFeedType.Remote,
            mx_VideoFeed_mirror: (
                this.props.type === VideoFeedType.Local &&
                SettingsStore.getValue('VideoView.flipVideoHorizontally')
            ),
        };

        let videoStyle = {};
        if (this.props.maxHeight) videoStyle = { maxHeight: this.props.maxHeight };

        return <video className={classnames(videoClasses)} ref={this.vid} style={videoStyle} />;
    }
}
