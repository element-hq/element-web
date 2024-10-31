/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { ReactNode } from "react";

import { useRovingTabIndex } from "../../../../accessibility/RovingTabIndex";
import AccessibleButton, { ButtonProps } from "../../elements/AccessibleButton";
import { Ref } from "../../../../accessibility/roving/types";

type TooltipOptionProps<T extends keyof JSX.IntrinsicElements> = ButtonProps<T> & {
    endAdornment?: ReactNode;
    inputRef?: Ref;
};

export const TooltipOption = <T extends keyof JSX.IntrinsicElements>({
    inputRef,
    className,
    element,
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
            element={element as keyof JSX.IntrinsicElements}
        />
    );
};
