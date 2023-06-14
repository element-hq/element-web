/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import React, { createRef, ReactNode, RefObject } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { Playback, PlaybackState } from "../../../audio/Playback";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { _t } from "../../../languageHandler";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import SeekBar from "./SeekBar";
import PlayPauseButton from "./PlayPauseButton";

export interface IProps {
    // Playback instance to render. Cannot change during component lifecycle: create
    // an all-new component instead.
    playback: Playback;

    mediaName?: string;
}

interface IState {
    playbackPhase: PlaybackState;
    error?: boolean;
}

export default abstract class AudioPlayerBase<T extends IProps = IProps> extends React.PureComponent<T, IState> {
    protected seekRef: RefObject<SeekBar> = createRef();
    protected playPauseRef: RefObject<PlayPauseButton> = createRef();

    public constructor(props: T) {
        super(props);

        // Playback instances can be reused in the composer
        this.state = {
            playbackPhase: this.props.playback.currentState,
        };

        // We don't need to de-register: the class handles this for us internally
        this.props.playback.on(UPDATE_EVENT, this.onPlaybackUpdate);

        // Don't wait for the promise to complete - it will emit a progress update when it
        // is done, and it's not meant to take long anyhow.
        this.props.playback.prepare().catch((e) => {
            logger.error("Error processing audio file:", e);
            this.setState({ error: true });
        });
    }

    protected onKeyDown = (ev: React.KeyboardEvent): void => {
        let handled = true;
        const action = getKeyBindingsManager().getAccessibilityAction(ev);

        switch (action) {
            case KeyBindingAction.Space:
                this.playPauseRef.current?.toggleState();
                break;
            case KeyBindingAction.ArrowLeft:
                this.seekRef.current?.left();
                break;
            case KeyBindingAction.ArrowRight:
                this.seekRef.current?.right();
                break;
            default:
                handled = false;
                break;
        }

        // stopPropagation() prevents the FocusComposer catch-all from triggering,
        // but we need to do it on key down instead of press (even though the user
        // interaction is typically on press).
        if (handled) {
            ev.stopPropagation();
        }
    };

    private onPlaybackUpdate = (ev: PlaybackState): void => {
        this.setState({ playbackPhase: ev });
    };

    protected abstract renderComponent(): ReactNode;

    public render(): ReactNode {
        return (
            <>
                {this.renderComponent()}
                {this.state.error && <div className="text-warning">{_t("Error downloading audio")}</div>}
            </>
        );
    }
}
