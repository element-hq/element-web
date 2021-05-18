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
import { CallFeed, CallFeedEvent } from 'matrix-js-sdk/src/webrtc/callFeed';
import { logger } from 'matrix-js-sdk/src/logger';
import MemberAvatar from "../avatars/MemberAvatar"
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    call: MatrixCall,

    feed: CallFeed,

    // Whether this call view is for picture-in-picture mode
    // otherwise, it's the larger call view when viewing the room the call is in.
    // This is sort of a proxy for a number of things but we currently have no
    // need to control those things separately, so this is simpler.
    pipMode?: boolean;

    // a callback which is called when the video element is resized
    // due to a change in video metadata
    onResize?: (e: Event) => void,
}

interface IState {
    audioMuted: boolean;
    videoMuted: boolean;
}

@replaceableComponent("views.voip.VideoFeed")
export default class VideoFeed extends React.Component<IProps, IState> {
    private element = createRef<HTMLVideoElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            audioMuted: this.props.feed.isAudioMuted(),
            videoMuted: this.props.feed.isVideoMuted(),
        };
    }

    componentDidMount() {
        this.props.feed.addListener(CallFeedEvent.NewStream, this.onNewStream);
        this.playMedia();
    }

    componentWillUnmount() {
        this.props.feed.removeListener(CallFeedEvent.NewStream, this.onNewStream);
        this.element.current?.removeEventListener('resize', this.onResize);
        this.stopMedia();
    }

    private playMedia() {
        const element = this.element.current;
        if (!element) return;
        // We play audio in AudioFeed, not here
        element.muted = true;
        element.srcObject = this.props.feed.stream;
        element.autoplay = true;
        try {
            // A note on calling methods on media elements:
            // We used to have queues per media element to serialise all calls on those elements.
            // The reason given for this was that load() and play() were racing. However, we now
            // never call load() explicitly so this seems unnecessary. However, serialising every
            // operation was causing bugs where video would not resume because some play command
            // had got stuck and all media operations were queued up behind it. If necessary, we
            // should serialise the ones that need to be serialised but then be able to interrupt
            // them with another load() which will cancel the pending one, but since we don't call
            // load() explicitly, it shouldn't be a problem. - Dave
            element.play()
        } catch (e) {
            logger.info("Failed to play media element with feed", this.props.feed, e);
        }
    }

    private stopMedia() {
        const element = this.element.current;
        if (!element) return;

        element.pause();
        element.src = null;

        // As per comment in componentDidMount, setting the sink ID back to the
        // default once the call is over makes setSinkId work reliably. - Dave
        // Since we are not using the same element anymore, the above doesn't
        // seem to be necessary - Šimon
    }

    private onNewStream = () => {
        this.setState({
            audioMuted: this.props.feed.isAudioMuted(),
            videoMuted: this.props.feed.isVideoMuted(),
        });
        this.playMedia();
    };

    private onResize = (e) => {
        if (this.props.onResize && !this.props.feed.isLocal()) {
            this.props.onResize(e);
        }
    };

    render() {
        const videoClasses = {
            mx_VideoFeed: true,
            mx_VideoFeed_local: this.props.feed.isLocal(),
            mx_VideoFeed_remote: !this.props.feed.isLocal(),
            mx_VideoFeed_voice: this.state.videoMuted,
            mx_VideoFeed_video: !this.state.videoMuted,
            mx_VideoFeed_mirror: (
                this.props.feed.isLocal() &&
                SettingsStore.getValue('VideoView.flipVideoHorizontally')
            ),
        };

        if (this.state.videoMuted) {
            const member = this.props.feed.getMember();
            const avatarSize = this.props.pipMode ? 76 : 160;

            return (
                <div className={classnames(videoClasses)} >
                    <MemberAvatar
                        member={member}
                        height={avatarSize}
                        width={avatarSize}
                    />
                </div>
            );
        } else {
            return (
                <video className={classnames(videoClasses)} ref={this.element} />
            );
        }
    }
}
