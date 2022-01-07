/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useState, HTMLAttributes } from 'react';

import Tooltip, { ITooltipProps } from './Tooltip';

interface IProps extends HTMLAttributes<HTMLSpanElement>, Omit<ITooltipProps, 'visible'> {
    tooltipTargetClassName?: string;
}

/**
 * Generic tooltip target element that handles tooltip visibility state
 * and displays children
 */
const TooltipTarget: React.FC<IProps> = ({
    children,
    tooltipTargetClassName,
    // tooltip pass through props
    className,
    id,
    label,
    alignment,
    yOffset,
    tooltipClassName,
    ...rest
}) => {
    const [isVisible, setIsVisible] = useState(false);

    const show = () => setIsVisible(true);
    const hide = () => setIsVisible(false);

    return (
        <div
            tabIndex={0}
            aria-describedby={id}
            className={tooltipTargetClassName}
            onMouseOver={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            {...rest}
        >
            { children }
            <Tooltip
                id={id}
                className={className}
                tooltipClassName={tooltipClassName}
                label={label}
                yOffset={yOffset}
                alignment={alignment}
                visible={isVisible}
            />
        </div>
    );
};

export default TooltipTarget;
