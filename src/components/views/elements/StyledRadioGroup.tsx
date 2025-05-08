/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEvent, type ReactNode } from "react";
import classNames from "classnames";

import StyledRadioButton from "./StyledRadioButton";

export interface IDefinition<T extends string> {
    value: T;
    className?: string;
    disabled?: boolean;
    label: ReactNode;
    description?: ReactNode;
    checked?: boolean; // If provided it will override the value comparison done in the group
}

interface IProps<T extends string> {
    name: string;
    className?: string;
    definitions: IDefinition<T>[];
    value?: T; // if not provided no options will be selected
    outlined?: boolean;
    disabled?: boolean;
    onChange(newValue: T): void;
}

function StyledRadioGroup<T extends string>({
    name,
    definitions,
    value,
    className,
    outlined,
    disabled,
    onChange,
}: IProps<T>): JSX.Element {
    const _onChange = (e: ChangeEvent<HTMLInputElement>): void => {
        onChange(e.target.value as T);
    };

    return (
        <React.Fragment>
            {definitions.map((d) => {
                const id = `${name}-${d.value}`;
                return (
                    <React.Fragment key={d.value}>
                        <StyledRadioButton
                            id={id}
                            className={classNames(className, d.className)}
                            onChange={_onChange}
                            checked={d.checked !== undefined ? d.checked : d.value === value}
                            name={name}
                            value={d.value}
                            disabled={d.disabled ?? disabled}
                            outlined={outlined}
                            aria-describedby={d.description ? `${id}-description` : undefined}
                        >
                            {d.label}
                        </StyledRadioButton>
                        {d.description ? <span id={`${id}-description`}>{d.description}</span> : null}
                    </React.Fragment>
                );
            })}
        </React.Fragment>
    );
}

export default StyledRadioGroup;
