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

import React, { createRef } from "react";
import { CallFeed, CallFeedEvent } from "matrix-js-sdk/src/webrtc/callFeed";
import { logger } from "matrix-js-sdk/src/logger";

import MediaDeviceHandler, { MediaDeviceHandlerEvent } from "../../../MediaDeviceHandler";

interface IProps {
    feed: CallFeed;
}

interface IState {
    audioMuted: boolean;
}

export default class AudioFeed extends React.Component<IProps, IState> {
    private element = createRef<HTMLAudioElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            audioMuted: this.props.feed.isAudioMuted(),
        };
    }

    public componentDidMount(): void {
        MediaDeviceHandler.instance.addListener(MediaDeviceHandlerEvent.AudioOutputChanged, this.onAudioOutputChanged);
        this.props.feed.addListener(CallFeedEvent.NewStream, this.onNewStream);
        this.playMedia();
    }

    public componentWillUnmount(): void {
        MediaDeviceHandler.instance.removeListener(
            MediaDeviceHandlerEvent.AudioOutputChanged,
            this.onAudioOutputChanged,
        );
        this.props.feed.removeListener(CallFeedEvent.NewStream, this.onNewStream);
        this.stopMedia();
    }

    private onAudioOutputChanged = (audioOutput: string): void => {
        const element = this.element.current;
        if (audioOutput) {
            try {
                // This seems quite unreliable in Chrome, although I haven't yet managed to make a jsfiddle where
                // it fails.
                // It seems reliable if you set the sink ID after setting the srcObject and then set the sink ID
                // back to the default after the call is over - Dave
                element!.setSinkId(audioOutput);
            } catch (e) {
                logger.error("Couldn't set requested audio output device: using default", e);
                logger.warn("Couldn't set requested audio output device: using default", e);
            }
        }
    };

    private async playMedia(): Promise<void> {
        const element = this.element.current;
        if (!element) return;
        this.onAudioOutputChanged(MediaDeviceHandler.getAudioOutput());
        element.muted = false;
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
            await element.load();
        } catch (e) {
            logger.info(
                `Failed to play media element with feed for userId ` +
                    `${this.props.feed.userId} with purpose ${this.props.feed.purpose}`,
                e,
            );
        }
    }

    private stopMedia(): void {
        const element = this.element.current;
        if (!element) return;

        element.pause();
        element.removeAttribute("src");

        // As per comment in componentDidMount, setting the sink ID back to the
        // default once the call is over makes setSinkId work reliably. - Dave
        // Since we are not using the same element anymore, the above doesn't
        // seem to be necessary - Šimon
    }

    private onNewStream = (): void => {
        this.setState({
            audioMuted: this.props.feed.isAudioMuted(),
        });
        this.playMedia();
    };

    public render(): React.ReactNode {
        // Do not render the audio element if there is no audio track
        if (this.state.audioMuted) return null;

        return <audio ref={this.element} />;
    }
}
