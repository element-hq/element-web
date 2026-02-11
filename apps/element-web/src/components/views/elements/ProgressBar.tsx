/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { useSmoothAnimation } from "../../../hooks/useSmoothAnimation";

interface IProps {
    value: number;
    max: number;
    animated?: boolean;
}

const PROGRESS_BAR_ANIMATION_DURATION = 300;
const ProgressBar: React.FC<IProps> = ({ value, max, animated = true }) => {
    // Animating progress bars via CSS transition isn’t possible in all of our supported browsers yet.
    // As workaround, we’re using animations through JS requestAnimationFrame
    const currentValue = useSmoothAnimation(0, value, animated ? PROGRESS_BAR_ANIMATION_DURATION : 0);
    return <progress className="mx_ProgressBar" max={max} value={currentValue} />;
};

export default ProgressBar;
