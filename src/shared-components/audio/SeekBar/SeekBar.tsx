/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type CSSProperties, type JSX, useEffect, useMemo, useState } from "react";
import { throttle } from "lodash";
import classNames from "classnames";

import style from "./SeekBar.module.css";
import { _t } from "../../utils/i18n";

export interface SeekBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    /**
     * The current value of the seek bar, between 0 and 100.
     * @default 0
     */
    value?: number;
}

interface ISeekCSS extends CSSProperties {
    "--fillTo": number;
}

/**
 * A seek bar component for audio playback.
 *
 * @example
 * ```tsx
 * <SeekBar value={50} onChange={(e) => console.log("New value", e.target.value)} />
 * ```
 */
export function SeekBar({ value = 0, className, ...rest }: SeekBarProps): JSX.Element {
    const [throttledValue, setValue] = useState(value);
    // Throttle the value setting to avoid excessive re-renders
    const setThrottledValue = useMemo(() => throttle(setValue, 10), []);

    useEffect(() => {
        setThrottledValue(value);
    }, [value, setThrottledValue]);

    return (
        <input
            type="range"
            className={classNames(style.seekBar, className)}
            onMouseDown={(e) => e.stopPropagation()}
            min={0}
            max={100}
            value={throttledValue}
            step={1}
            style={{ "--fillTo": throttledValue / 100 } as ISeekCSS}
            aria-label={_t("a11y|seek_bar_label")}
            {...rest}
        />
    );
}
