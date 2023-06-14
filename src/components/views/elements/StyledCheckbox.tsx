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
import { randomString } from "matrix-js-sdk/src/randomstring";
import classnames from "classnames";

export enum CheckboxStyle {
    Solid = "solid",
    Outline = "outline",
}

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
    inputRef?: React.RefObject<HTMLInputElement>;
    kind?: CheckboxStyle;
    id?: string;
}

interface IState {}

export default class StyledCheckbox extends React.PureComponent<IProps, IState> {
    private id: string;

    public static readonly defaultProps = {
        className: "",
    };

    public constructor(props: IProps) {
        super(props);
        // 56^10 so unlikely chance of collision.
        this.id = this.props.id || "checkbox_" + randomString(10);
    }

    public render(): React.ReactNode {
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const { children, className, kind = CheckboxStyle.Solid, inputRef, ...otherProps } = this.props;

        const newClassName = classnames("mx_Checkbox", className, {
            mx_Checkbox_hasKind: kind,
            [`mx_Checkbox_kind_${kind}`]: kind,
        });
        return (
            <span className={newClassName}>
                <input
                    // Pass through the ref - used for keyboard shortcut access to some buttons
                    ref={inputRef}
                    id={this.id}
                    {...otherProps}
                    type="checkbox"
                />
                <label htmlFor={this.id}>
                    {/* Using the div to center the image */}
                    <div className="mx_Checkbox_background">
                        <div className="mx_Checkbox_checkmark" />
                    </div>
                    {!!this.props.children && <div>{this.props.children}</div>}
                </label>
            </span>
        );
    }
}
