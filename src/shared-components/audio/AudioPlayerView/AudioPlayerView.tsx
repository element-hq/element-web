/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ChangeEventHandler, type JSX, type KeyboardEventHandler, type MouseEventHandler } from "react";

import { type ViewModel } from "../../ViewModel";
import { useViewModel } from "../../useViewModel";
import { MediaBody } from "../../message-body/MediaBody";
import { Flex } from "../../utils/Flex";
import styles from "./AudioPlayerView.module.css";
import { PlayPauseButton } from "../PlayPauseButton";
import { type PlaybackState } from "../playback";
import { _t } from "../../utils/i18n";
import { formatBytes } from "../../utils/FormattingUtils";
import { Clock } from "../Clock";
import { SeekBar } from "../SeekBar";

export interface AudioPlayerViewSnapshot {
    /**
     * The playback state of the audio player.
     */
    playbackState: PlaybackState;
    /**
     * Name of the media being played.
     * @default Fallback to "timeline|m.audio|unnamed_audio" string if not provided.
     */
    mediaName?: string;
    /**
     * Size of the audio file in bytes.
     * Hided if not provided.
     */
    sizeBytes?: number;
    /**
     * The duration of the audio clip in seconds.
     */
    durationSeconds: number;
    /**
     * The percentage of the audio that has been played.
     * Ranges from 0 to 100.
     */
    percentComplete: number;
    /**
     * The number of seconds that have been played.
     */
    playedSeconds: number;
    /**
     * Indicates if there was an error downloading the audio.
     */
    error: boolean;
}

export interface AudioPlayerViewActions {
    /**
     * Handles key down events for the audio player.
     */
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
    /**
     * Toggles the play/pause state of the audio player.
     */
    togglePlay: MouseEventHandler<HTMLButtonElement>;
    /**
     * Handles changes to the seek bar.
     */
    onSeekbarChange: ChangeEventHandler<HTMLInputElement>;
}

/**
 * The view model for the audio player.
 */
export type AudioPlayerViewModel = ViewModel<AudioPlayerViewSnapshot> & AudioPlayerViewActions;

interface AudioPlayerViewProps {
    /**
     * The view model for the audio player.
     */
    vm: AudioPlayerViewModel;
}

/**
 * AudioPlayer component displays an audio player with play/pause controls, seek bar, and media information.
 * The component expects a view model that provides the current state of the audio playback,
 *
 * @example
 * ```tsx
 * <AudioPlayerView vm={audioPlayerViewModel} />
 * ```
 */
export function AudioPlayerView({ vm }: Readonly<AudioPlayerViewProps>): JSX.Element {
    const {
        playbackState,
        mediaName = _t("timeline|m.audio|unnamed_audio"),
        sizeBytes,
        durationSeconds,
        playedSeconds,
        percentComplete,
        error,
    } = useViewModel(vm);
    const fileSize = sizeBytes ? `(${formatBytes(sizeBytes)})` : null;
    const disabled = playbackState === "decoding";

    // tabIndex=0 to ensure that the whole component becomes a tab stop, where we handle keyboard
    // events for accessibility
    return (
        <>
            <MediaBody
                className={styles.audioPlayer}
                tabIndex={0}
                onKeyDown={vm.onKeyDown}
                aria-label={_t("timeline|m.audio|audio_player")}
                role="region"
            >
                <Flex gap="var(--cpd-space-2x)" align="center">
                    <PlayPauseButton
                        // Prevent tabbing into the button
                        // Keyboard navigation is handled at the MediaBody level
                        tabIndex={-1}
                        disabled={disabled}
                        playing={playbackState === "playing"}
                        togglePlay={vm.togglePlay}
                    />
                    <Flex direction="column" className={styles.mediaInfo}>
                        <span className={styles.mediaName} data-testid="audio-player-name">
                            {mediaName}
                        </span>
                        <Flex className={styles.byline} gap="var(--cpd-space-1-5x)">
                            <Clock seconds={durationSeconds} />
                            {fileSize}
                        </Flex>
                    </Flex>
                </Flex>
                <Flex align="center" gap="var(--cpd-space-1x)" data-testid="audio-player-seek">
                    <SeekBar tabIndex={-1} disabled={disabled} value={percentComplete} onChange={vm.onSeekbarChange} />
                    <Clock className={styles.clock} seconds={playedSeconds} role="timer" />
                </Flex>
            </MediaBody>
            {error && <span className={styles.error}>{_t("timeline|m.audio|error_downloading_audio")}</span>}
        </>
    );
}
