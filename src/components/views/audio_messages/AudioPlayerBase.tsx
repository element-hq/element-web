/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { Playback, PlaybackState } from "../../../audio/Playback";
import { TileShape } from "../rooms/EventTile";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { _t } from "../../../languageHandler";

interface IProps {
    // Playback instance to render. Cannot change during component lifecycle: create
    // an all-new component instead.
    playback: Playback;

    mediaName?: string;
    tileShape?: TileShape;
}

interface IState {
    playbackPhase: PlaybackState;
    error?: boolean;
}

@replaceableComponent("views.audio_messages.AudioPlayerBase")
export default abstract class AudioPlayerBase extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            playbackPhase: PlaybackState.Decoding, // default assumption
        };

        // We don't need to de-register: the class handles this for us internally
        this.props.playback.on(UPDATE_EVENT, this.onPlaybackUpdate);

        // Don't wait for the promise to complete - it will emit a progress update when it
        // is done, and it's not meant to take long anyhow.
        this.props.playback.prepare().catch(e => {
            logger.error("Error processing audio file:", e);
            this.setState({ error: true });
        });
    }

    private onPlaybackUpdate = (ev: PlaybackState) => {
        this.setState({ playbackPhase: ev });
    };

    protected abstract renderComponent(): ReactNode;

    public render(): ReactNode {
        return <>
            { this.renderComponent() }
            { this.state.error && <div className="text-warning">{ _t("Error downloading audio") }</div> }
        </>;
    }
}
