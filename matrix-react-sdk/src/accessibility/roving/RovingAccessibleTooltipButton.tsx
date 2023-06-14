/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import AccessibleTooltipButton from "../../components/views/elements/AccessibleTooltipButton";
import { useRovingTabIndex } from "../RovingTabIndex";
import { Ref } from "./types";

type ATBProps = React.ComponentProps<typeof AccessibleTooltipButton>;
interface IProps extends Omit<ATBProps, "inputRef" | "tabIndex"> {
    inputRef?: Ref;
}

// Wrapper to allow use of useRovingTabIndex for simple AccessibleTooltipButtons outside of React Functional Components.
export const RovingAccessibleTooltipButton: React.FC<IProps> = ({ inputRef, onFocus, ...props }) => {
    const [onFocusInternal, isActive, ref] = useRovingTabIndex(inputRef);
    return (
        <AccessibleTooltipButton
            {...props}
            onFocus={(event: React.FocusEvent) => {
                onFocusInternal();
                onFocus?.(event);
            }}
            inputRef={ref}
            tabIndex={isActive ? 0 : -1}
        />
    );
};
