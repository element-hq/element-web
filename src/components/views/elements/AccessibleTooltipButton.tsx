/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, { SyntheticEvent, FocusEvent, forwardRef, useEffect, Ref, useState, ComponentProps } from "react";

import AccessibleButton from "./AccessibleButton";
import Tooltip, { Alignment } from "./Tooltip";

/**
 * Type of props accepted by {@link AccessibleTooltipButton}.
 *
 * Extends that of {@link AccessibleButton}.
 */
type Props<T extends keyof JSX.IntrinsicElements> = ComponentProps<typeof AccessibleButton<T>> & {
    /**
     * Title to show in the tooltip and use as aria-label
     */
    title?: string;
    /**
     * Tooltip node to show in the tooltip, takes precedence over `title`
     */
    tooltip?: React.ReactNode;
    /**
     * Trigger label to render
     */
    label?: string;
    /**
     * Classname to apply to the tooltip
     */
    tooltipClassName?: string;
    /**
     * Force the tooltip to be hidden
     */
    forceHide?: boolean;
    /**
     * Alignment to render the tooltip with
     */
    alignment?: Alignment;
    /**
     * Function to call when the children are hovered over
     */
    onHover?: (hovering: boolean) => void;
    /**
     * Function to call when the tooltip goes from shown to hidden.
     */
    onHideTooltip?(ev: SyntheticEvent): void;
};

const AccessibleTooltipButton = forwardRef(function <T extends keyof JSX.IntrinsicElements>(
    { title, tooltip, children, forceHide, alignment, onHideTooltip, tooltipClassName, ...props }: Props<T>,
    ref: Ref<HTMLElement>,
) {
    const [hover, setHover] = useState(false);

    useEffect(() => {
        // If forceHide is set then force hover to off to hide the tooltip
        if (forceHide && hover) {
            setHover(false);
        }
    }, [forceHide, hover]);

    const showTooltip = (): void => {
        props.onHover?.(true);
        if (forceHide) return;
        setHover(true);
    };

    const hideTooltip = (ev: SyntheticEvent): void => {
        props.onHover?.(false);
        setHover(false);
        onHideTooltip?.(ev);
    };

    const onFocus = (ev: FocusEvent): void => {
        // We only show the tooltip if focus arrived here from some other
        // element, to avoid leaving tooltips hanging around when a modal closes
        if (ev.relatedTarget) showTooltip();
    };

    const tip = hover && (title || tooltip) && (
        <Tooltip tooltipClassName={tooltipClassName} label={tooltip || title} alignment={alignment} />
    );
    return (
        <AccessibleButton
            {...props}
            onMouseOver={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={onFocus}
            onBlur={hideTooltip}
            aria-label={title || props["aria-label"]}
            ref={ref}
        >
            {children}
            {props.label}
            {(tooltip || title) && tip}
        </AccessibleButton>
    );
});

export default AccessibleTooltipButton;
