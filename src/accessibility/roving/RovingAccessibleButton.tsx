/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type RefObject } from "react";

import AccessibleButton, { type ButtonProps } from "../../components/views/elements/AccessibleButton";
import { useRovingTabIndex } from "../RovingTabIndex";

type Props<T extends keyof HTMLElementTagNameMap> = Omit<ButtonProps<T>, "tabIndex"> & {
    inputRef?: RefObject<HTMLElementTagNameMap[T] | null>;
    focusOnMouseOver?: boolean;
};

// Wrapper to allow use of useRovingTabIndex for simple AccessibleButtons outside of React Functional Components.
export const RovingAccessibleButton = <T extends keyof HTMLElementTagNameMap>({
    inputRef,
    onFocus,
    onMouseOver,
    focusOnMouseOver,
    ...props
}: Props<T>): JSX.Element => {
    const [onFocusInternal, isActive, ref] = useRovingTabIndex<HTMLElementTagNameMap[T]>(inputRef);
    return (
        <AccessibleButton
            {...props}
            onFocus={(event: React.FocusEvent<never, never>) => {
                onFocusInternal();
                onFocus?.(event);
            }}
            onMouseOver={(event: React.MouseEvent<never, never>) => {
                if (focusOnMouseOver) onFocusInternal();
                onMouseOver?.(event);
            }}
            ref={ref}
            tabIndex={isActive ? 0 : -1}
        />
    );
};
