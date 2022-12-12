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

import classNames from "classnames";
import React, { ComponentProps, ReactNode } from "react";

import { RovingAccessibleTooltipButton } from "../../../../accessibility/roving/RovingAccessibleTooltipButton";
import { useRovingTabIndex } from "../../../../accessibility/RovingTabIndex";
import AccessibleTooltipButton from "../../elements/AccessibleTooltipButton";

interface TooltipOptionProps extends ComponentProps<typeof RovingAccessibleTooltipButton> {
    endAdornment?: ReactNode;
}

export const TooltipOption: React.FC<TooltipOptionProps> = ({ inputRef, className, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return (
        <AccessibleTooltipButton
            {...props}
            className={classNames(className, "mx_SpotlightDialog_option")}
            onFocus={onFocus}
            inputRef={ref}
            tabIndex={-1}
            aria-selected={isActive}
            role="option"
        />
    );
};
