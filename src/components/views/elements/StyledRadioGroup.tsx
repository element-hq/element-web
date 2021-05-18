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
import classNames from "classnames";

import StyledRadioButton from "./StyledRadioButton";

interface IDefinition<T extends string> {
    value: T;
    className?: string;
    disabled?: boolean;
    label: React.ReactChild;
    description?: React.ReactChild;
    checked?: boolean; // If provided it will override the value comparison done in the group
}

interface IProps<T extends string> {
    name: string;
    className?: string;
    definitions: IDefinition<T>[];
    value?: T; // if not provided no options will be selected
    outlined?: boolean;
    onChange(newValue: T): void;
}

function StyledRadioGroup<T extends string>({name, definitions, value, className, outlined, onChange}: IProps<T>) {
    const _onChange = e => {
        onChange(e.target.value);
    };

    return <React.Fragment>
        {definitions.map(d => <React.Fragment key={d.value}>
            <StyledRadioButton
                className={classNames(className, d.className)}
                onChange={_onChange}
                checked={d.checked !== undefined ? d.checked : d.value === value}
                name={name}
                value={d.value}
                disabled={d.disabled}
                outlined={outlined}
            >
                {d.label}
            </StyledRadioButton>
            {d.description}
        </React.Fragment>)}
    </React.Fragment>;
}

export default StyledRadioGroup;
