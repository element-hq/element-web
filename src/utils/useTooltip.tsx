/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps, useState } from "react";

import Tooltip from "../components/views/elements/Tooltip";

interface TooltipEvents {
    showTooltip: () => void;
    hideTooltip: () => void;
}

export function useTooltip(props: ComponentProps<typeof Tooltip>): [TooltipEvents, JSX.Element | null] {
    const [isVisible, setIsVisible] = useState(false);

    const showTooltip = (): void => setIsVisible(true);
    const hideTooltip = (): void => setIsVisible(false);

    // No need to fill up the DOM with hidden tooltip elements. Only add the
    // tooltip when we're hovering over the item (performance)
    const tooltip = <Tooltip {...props} visible={isVisible} />;

    return [{ showTooltip, hideTooltip }, tooltip];
}
