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

import React, { ComponentProps } from "react";

import AccessibleButton from "../../components/views/elements/AccessibleButton";
import { useRovingTabIndex } from "../RovingTabIndex";
import { Ref } from "./types";

type Props<T extends keyof JSX.IntrinsicElements> = Omit<
    ComponentProps<typeof AccessibleButton<T>>,
    "inputRef" | "tabIndex"
> & {
    inputRef?: Ref;
    focusOnMouseOver?: boolean;
};

// Wrapper to allow use of useRovingTabIndex for simple AccessibleButtons outside of React Functional Components.
export const RovingAccessibleButton = <T extends keyof JSX.IntrinsicElements>({
    inputRef,
    onFocus,
    onMouseOver,
    focusOnMouseOver,
    element,
    ...props
}: Props<T>): JSX.Element => {
    const [onFocusInternal, isActive, ref] = useRovingTabIndex(inputRef);
    return (
        <AccessibleButton
            {...props}
            element={element as keyof JSX.IntrinsicElements}
            onFocus={(event: React.FocusEvent) => {
                onFocusInternal();
                onFocus?.(event);
            }}
            onMouseOver={(event: React.MouseEvent) => {
                if (focusOnMouseOver) onFocusInternal();
                onMouseOver?.(event);
            }}
            ref={ref}
            tabIndex={isActive ? 0 : -1}
        />
    );
};
