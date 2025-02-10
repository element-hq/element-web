/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type ReactNode, type RefObject } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { type Playback, type PlaybackState } from "../../../audio/Playback";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { _t } from "../../../languageHandler";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import type SeekBar from "./SeekBar";
import type PlayPauseButton from "./PlayPauseButton";

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
    }

    public componentDidMount(): void {
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
                {this.state.error && (
                    <div className="text-warning">{_t("timeline|m.audio|error_downloading_audio")}</div>
                )}
            </>
        );
    }
}
