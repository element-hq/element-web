/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
