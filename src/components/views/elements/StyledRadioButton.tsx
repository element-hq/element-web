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
import classnames from "classnames";

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
    inputRef?: React.RefObject<HTMLInputElement>;
    outlined?: boolean;
    // If true (default), the children will be contained within a <label> element
    // If false, they'll be in a div. Putting interactive components that have labels
    // themselves in labels can cause strange bugs like https://github.com/vector-im/element-web/issues/18031
    childrenInLabel?: boolean;
}

interface IState {}

export default class StyledRadioButton extends React.PureComponent<IProps, IState> {
    public static readonly defaultProps = {
        className: "",
        childrenInLabel: true,
    };

    public render(): React.ReactNode {
        const { children, className, disabled, outlined, childrenInLabel, inputRef, ...otherProps } = this.props;
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
                {/* Used to render the radio button circle */}
                <div>
                    <div />
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
