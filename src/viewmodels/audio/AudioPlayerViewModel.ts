/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ChangeEvent, type KeyboardEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import {
    type AudioPlayerViewSnapshot,
    type AudioPlayerViewModel as AudioPlayerViewModelInterface,
} from "../../shared-components/audio/AudioPlayerView";
import { type Playback } from "../../audio/Playback";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { percentageOf } from "../../shared-components/utils/numbers";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import { BaseViewModel } from "../base/BaseViewModel";

/**
 * The number of seconds to skip when the user presses the left or right arrow keys.
 */
const ARROW_SKIP_SECONDS = 5;

interface Props {
    /**
     * The playback instance that manages the audio playback.
     */
    playback: Playback;
    /**
     * Optional name of the media being played.
     */
    mediaName?: string;
}

/**
 * ViewModel for the audio player, providing the current state of the audio playback.
 * It listens to updates from the Playback instance and computes a snapshot.
 */
export class AudioPlayerViewModel
    extends BaseViewModel<AudioPlayerViewSnapshot, Props>
    implements AudioPlayerViewModelInterface
{
    /**
     * Indicates if there was an error processing the audio file.
     * @private
     */
    private error = false;

    /**
     * Computes the snapshot of the audio player based on the current playback state.
     * This includes the media name, size in bytes, playback state, duration, percentage complete,
     * played seconds, and whether there was an error.
     * @param playback - The playback instance managing the audio playback.
     * @param mediaName - Optional name of the media being played.
     * @param error - Indicates if there was an error processing the audio file.
     */
    private static readonly computeSnapshot = (
        playback: Playback,
        mediaName?: string,
        error = false,
    ): AudioPlayerViewSnapshot => {
        const percentComplete = percentageOf(playback.timeSeconds, 0, playback.durationSeconds) * 100;

        return {
            mediaName,
            sizeBytes: playback.sizeBytes,
            playbackState: playback.currentState,
            durationSeconds: playback.durationSeconds,
            percentComplete,
            playedSeconds: playback.timeSeconds,
            error,
        };
    };

    public constructor(props: Props) {
        super(props, AudioPlayerViewModel.computeSnapshot(props.playback, props.mediaName));
        this.disposables.trackListener(props.playback, UPDATE_EVENT, this.setSnapshot);
        // There is no unsubscribe method in SimpleObservable
        this.props.playback.clockInfo.liveData.onUpdate(this.setSnapshot);

        // Don't wait for the promise to complete - it will emit a progress update when it
        // is done, and it's not meant to take long anyhow.
        this.preparePlayback();
    }

    /**
     * Prepares the playback by calling the prepare method on the playback instance.
     * @private
     */
    private async preparePlayback(): Promise<void> {
        try {
            await this.props.playback.prepare();
        } catch (e) {
            logger.error("Error processing audio file:", e, this.props.playback.currentState);
            this.error = true;
            this.setSnapshot();
        }
    }

    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(AudioPlayerViewModel.computeSnapshot(this.props.playback, this.props.mediaName, this.error));
    };

    public onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
        let handled = true;
        const action = getKeyBindingsManager().getAccessibilityAction(ev);

        switch (action) {
            case KeyBindingAction.Space:
                this.togglePlay();
                break;
            case KeyBindingAction.ArrowLeft:
                this.props.playback.skipTo(this.props.playback.timeSeconds - ARROW_SKIP_SECONDS);
                break;
            case KeyBindingAction.ArrowRight:
                this.props.playback.skipTo(this.props.playback.timeSeconds + ARROW_SKIP_SECONDS);
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

    public togglePlay = async (): Promise<void> => {
        await this.props.playback.toggle();
    };

    public onSeekbarChange = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
        await this.props.playback.skipTo((Number(ev.target.value) / 100) * this.props.playback.durationSeconds);
    };
}
