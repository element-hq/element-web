/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type Ref } from "react";
import classnames from "classnames";

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
    inputRef?: Ref<HTMLInputElement>;
    outlined?: boolean;
    // If true (default), the children will be contained within a <label> element
    // If false, they'll be in a div. Putting interactive components that have labels
    // themselves in labels can cause strange bugs like https://github.com/vector-im/element-web/issues/18031
    childrenInLabel?: boolean;

    /**
     * If provided will override the default dot icon drawn for checked state
     */
    icon?: JSX.Element;
}

export default class StyledRadioButton extends React.PureComponent<IProps> {
    public static readonly defaultProps = {
        className: "",
        childrenInLabel: true,
    };

    public render(): React.ReactNode {
        const { children, className, disabled, outlined, childrenInLabel, inputRef, icon, ...otherProps } = this.props;
        const _className = classnames("mx_StyledRadioButton", className, {
            mx_StyledRadioButton_disabled: disabled,
            mx_StyledRadioButton_enabled: !disabled,
            mx_StyledRadioButton_checked: this.props.checked,
            mx_StyledRadioButton_outlined: outlined,
        });

        const radioButton = (
            <React.Fragment>
                <input
                    // Pass through the ref - used for keyboard shortcut access to some buttons
                    ref={inputRef}
                    type="radio"
                    disabled={disabled}
                    {...otherProps}
                />
                <div>
                    {/* Empty div is used to render the radio button circle */}
                    <div>{icon}</div>
                </div>
            </React.Fragment>
        );

        if (childrenInLabel) {
            return (
                <label className={_className}>
                    {radioButton}
                    <div className="mx_StyledRadioButton_content">{children}</div>
                    <div className="mx_StyledRadioButton_spacer" />
                </label>
            );
        } else {
            return (
                <div className={_className}>
                    <label className="mx_StyledRadioButton_innerLabel">{radioButton}</label>
                    <div className="mx_StyledRadioButton_content">{children}</div>
                    <div className="mx_StyledRadioButton_spacer" />
                </div>
            );
        }
    }
}
