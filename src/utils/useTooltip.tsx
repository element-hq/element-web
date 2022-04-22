import React, { ComponentProps, useState } from "react";

import Tooltip from "../components/views/elements/Tooltip";

interface TooltipEvents {
    showTooltip: () => void;
    hideTooltip: () => void;
}

export function useTooltip(props: ComponentProps<typeof Tooltip>): [TooltipEvents, JSX.Element | null] {
    const [isVisible, setIsVisible] = useState(false);

    const showTooltip = () => setIsVisible(true);
    const hideTooltip = () => setIsVisible(false);

    // No need to fill up the DOM with hidden tooltip elements. Only add the
    // tooltip when we're hovering over the item (performance)
    const tooltip = <Tooltip
        {...props}
        visible={isVisible}
    />;

    return [{ showTooltip, hideTooltip }, tooltip];
}
