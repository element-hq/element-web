/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type Ref } from "react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import classnames from "classnames";

export enum CheckboxStyle {
    Solid = "solid",
    Outline = "outline",
}

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
    inputRef?: Ref<HTMLInputElement>;
    kind?: CheckboxStyle;
    id?: string;
}

export default class StyledCheckbox extends React.PureComponent<IProps> {
    private id: string;

    public static readonly defaultProps = {
        className: "",
    };

    public constructor(props: IProps) {
        super(props);
        // 56^10 so unlikely chance of collision.
        this.id = this.props.id || "checkbox_" + secureRandomString(10);
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
