/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type ReactNode } from "react";

import { useRovingTabIndex } from "../../../../accessibility/RovingTabIndex";
import AccessibleButton, { type ButtonEvent } from "../../elements/AccessibleButton";

interface OptionProps {
    endAdornment?: ReactNode;
    id?: string;
    className?: string;
    onClick: ((ev: ButtonEvent) => void) | null;
    children?: ReactNode;
}

export const Option: React.FC<OptionProps> = ({ children, endAdornment, className, onClick, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLLIElement>();
    const optionClassName = classNames(className, "mx_SpotlightDialog_option");
    const content = (
        <>
            {children}
            <div className="mx_SpotlightDialog_option--endAdornment">
                {onClick && (
                    <kbd className="mx_SpotlightDialog_enterPrompt" aria-hidden>
                        ↵
                    </kbd>
                )}
                {endAdornment}
            </div>
        </>
    );

    if (!onClick) {
        return (
            <li
                {...props}
                className={optionClassName}
                onFocus={onFocus}
                ref={ref}
                tabIndex={-1}
                aria-selected={isActive}
                aria-disabled={true}
                role="option"
            >
                {content}
            </li>
        );
    }

    return (
        <AccessibleButton
            {...props}
            onClick={onClick}
            className={optionClassName}
            onFocus={onFocus}
            ref={ref}
            tabIndex={-1}
            aria-selected={isActive}
            role="option"
            element="li"
        >
            {content}
        </AccessibleButton>
    );
};
