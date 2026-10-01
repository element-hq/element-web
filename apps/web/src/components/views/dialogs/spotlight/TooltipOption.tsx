/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX, type ReactNode, type RefObject } from "react";

import { useRovingTabIndex } from "../../../../accessibility/RovingTabIndex";
import AccessibleButton, { type ButtonProps } from "../../elements/AccessibleButton";

type TooltipOptionProps<T extends keyof HTMLElementTagNameMap> = ButtonProps<T> & {
    className?: string;
    endAdornment?: ReactNode;
    inputRef?: RefObject<HTMLElement | null>;
};

export const TooltipOption = <T extends keyof HTMLElementTagNameMap>({
    inputRef,
    className,
    ...props
}: TooltipOptionProps<T>): JSX.Element => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return (
        <AccessibleButton
            {...props}
            className={classNames(className, "mx_SpotlightDialog_option")}
            onFocus={onFocus}
            ref={ref}
            tabIndex={-1}
            aria-selected={isActive}
            role="option"
        />
    );
};
