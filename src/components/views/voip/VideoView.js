/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, {createRef} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import * as sdk from '../../../index';
import dis from '../../../dispatcher/dispatcher';

import SettingsStore from "../../../settings/SettingsStore";

function getFullScreenElement() {
    return (
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
    );
}

export default class VideoView extends React.Component {
    static propTypes = {
        // maxHeight style attribute for the video element
        maxHeight: PropTypes.number,

        // a callback which is called when the user clicks on the video div
        onClick: PropTypes.func,

        // a callback which is called when the video element is resized due to
        // a change in video metadata
        onResize: PropTypes.func,
    };

    constructor(props) {
        super(props);

        this._local = createRef();
        this._remote = createRef();
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    getRemoteVideoElement = () => {
        return ReactDOM.findDOMNode(this._remote.current);
    };

    getRemoteAudioElement = () => {
        // this needs to be somewhere at the top of the DOM which
        // always exists to avoid audio interruptions.
        // Might as well just use DOM.
        const remoteAudioElement = document.getElementById("remoteAudio");
        if (!remoteAudioElement) {
            console.error("Failed to find remoteAudio element - cannot play audio!"
                + "You need to add an <audio/> to the DOM.");
        }
        return remoteAudioElement;
    };

    getLocalVideoElement = () => {
        return ReactDOM.findDOMNode(this._local.current);
    };

    setContainer = (c) => {
        this.container = c;
    };

    onAction = (payload) => {
        switch (payload.action) {
            case 'video_fullscreen': {
                if (!this.container) {
                    return;
                }
                const element = this.container;
                if (payload.fullscreen) {
                    const requestMethod = (
                        element.requestFullScreen ||
                        element.webkitRequestFullScreen ||
                        element.mozRequestFullScreen ||
                        element.msRequestFullscreen
                    );
                    requestMethod.call(element);
                } else if (getFullScreenElement()) {
                    const exitMethod = (
                        document.exitFullscreen ||
                        document.mozCancelFullScreen ||
                        document.webkitExitFullscreen ||
                        document.msExitFullscreen
                    );
                    if (exitMethod) {
                        exitMethod.call(document);
                    }
                }
                break;
            }
        }
    };

    render() {
        const VideoFeed = sdk.getComponent('voip.VideoFeed');

        // if we're fullscreen, we don't want to set a maxHeight on the video element.
        const maxVideoHeight = getFullScreenElement() ? null : this.props.maxHeight;
        const localVideoFeedClasses = classNames("mx_VideoView_localVideoFeed",
            { "mx_VideoView_localVideoFeed_flipped":
                SettingsStore.getValue('VideoView.flipVideoHorizontally'),
            },
        );
        return (
            <div className="mx_VideoView" ref={this.setContainer} onClick={this.props.onClick}>
                <div className="mx_VideoView_remoteVideoFeed">
                    <VideoFeed ref={this._remote} onResize={this.props.onResize}
                        maxHeight={maxVideoHeight} />
                </div>
                <div className={localVideoFeedClasses}>
                    <VideoFeed ref={this._local} />
                </div>
            </div>
        );
    }
}
