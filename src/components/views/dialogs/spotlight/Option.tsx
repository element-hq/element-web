/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { ReactNode, RefObject } from "react";

import { useRovingTabIndex } from "../../../../accessibility/RovingTabIndex";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";

interface OptionProps {
    inputRef?: RefObject<HTMLLIElement>;
    endAdornment?: ReactNode;
    id?: string;
    className?: string;
    onClick: ((ev: ButtonEvent) => void) | null;
    children?: ReactNode;
}

export const Option: React.FC<OptionProps> = ({ inputRef, children, endAdornment, className, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLLIElement>(inputRef);
    return (
        <AccessibleButton
            {...props}
            className={classNames(className, "mx_SpotlightDialog_option")}
            onFocus={onFocus}
            ref={ref}
            tabIndex={-1}
            aria-selected={isActive}
            role="option"
            element="li"
        >
            {children}
            <div className="mx_SpotlightDialog_option--endAdornment">
                <kbd className="mx_SpotlightDialog_enterPrompt" aria-hidden>
                    ↵
                </kbd>
                {endAdornment}
            </div>
        </AccessibleButton>
    );
};
