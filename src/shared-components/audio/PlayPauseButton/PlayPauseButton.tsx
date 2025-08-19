/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes, type JSX, type MouseEventHandler } from "react";
import { IconButton } from "@vector-im/compound-web";
import Play from "@vector-im/compound-design-tokens/assets/web/icons/play-solid";
import Pause from "@vector-im/compound-design-tokens/assets/web/icons/pause-solid";

import styles from "./PlayPauseButton.module.css";
import { _t } from "../../utils/i18n";

export interface PlayPauseButtonProps extends HTMLAttributes<HTMLButtonElement> {
    /**
     * Whether the button is disabled.
     * @default false
     */
    disabled?: boolean;

    /**
     * Whether the audio is currently playing.
     * @default false
     */
    playing?: boolean;

    /**
     * Function to toggle play/pause state.
     */
    togglePlay: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A button component that toggles between play and pause states for audio playback.
 *
 * @example
 * ```tsx
 * <PlayPauseButton playing={true} togglePlay={() => {}} />
 * ```
 */
export function PlayPauseButton({
    disabled = false,
    playing = false,
    togglePlay,
    ...rest
}: Readonly<PlayPauseButtonProps>): JSX.Element {
    const label = playing ? _t("action|pause") : _t("action|play");

    return (
        <IconButton
            size="32px"
            aria-label={label}
            tooltip={label}
            onClick={togglePlay}
            className={styles.button}
            disabled={disabled}
            {...rest}
        >
            {playing ? <Pause /> : <Play />}
        </IconButton>
    );
}
