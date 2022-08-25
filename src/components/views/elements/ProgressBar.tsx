/*
Copyright 2020,2022 The Matrix.org Foundation C.I.C.

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
