/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd.
Copyright 2017 Aidan Gauland

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";

import { _t } from "../../../languageHandler";

interface IProps {
    // The primary button which is styled differently and has default focus.
    primaryButton: React.ReactNode;

    // A node to insert into the cancel button instead of default "Cancel"
    cancelButton?: React.ReactNode;

    // If true, make the primary button a form submit button (input type="submit")
    primaryIsSubmit?: boolean;

    // onClick handler for the primary button. Note that the returned promise, if
    // returning a promise, is not used.
    onPrimaryButtonClick?: (ev: React.MouseEvent) => void | Promise<void>;

    // should there be a cancel button? default: true
    hasCancel?: boolean;

    // The class of the cancel button, only used if a cancel button is
    // enabled
    cancelButtonClass?: string;

    // onClick handler for the cancel button.
    onCancel?: (...args: any[]) => void;

    focus?: boolean;

    // disables the primary and cancel buttons
    disabled?: boolean;

    // disables only the primary button
    primaryDisabled?: boolean;

    // something to stick next to the buttons, optionally
    additive?: ReactNode;

    primaryButtonClass?: string;
    children?: ReactNode;
}

/**
 * Basic container for buttons in modal dialogs.
 */
export default class DialogButtons extends React.Component<IProps> {
    public static defaultProps: Partial<IProps> = {
        hasCancel: true,
        disabled: false,
    };

    private onCancelClick = (event: React.MouseEvent): void => {
        this.props.onCancel?.(event);
    };

    public render(): React.ReactNode {
        let primaryButtonClassName = "mx_Dialog_primary";
        if (this.props.primaryButtonClass) {
            primaryButtonClassName += " " + this.props.primaryButtonClass;
        }

        let cancelButton: JSX.Element | undefined;
        if (this.props.hasCancel) {
            cancelButton = (
                <button
                    // important: the default type is 'submit' and this button comes before the
                    // primary in the DOM so will get form submissions unless we make it not a submit.
                    data-testid="dialog-cancel-button"
                    type="button"
                    onClick={this.onCancelClick}
                    className={this.props.cancelButtonClass}
                    disabled={this.props.disabled}
                >
                    {this.props.cancelButton || _t("action|cancel")}
                </button>
            );
        }

        let additive: JSX.Element | undefined;
        if (this.props.additive) {
            additive = <div className="mx_Dialog_buttons_additive">{this.props.additive}</div>;
        }

        return (
            <div className="mx_Dialog_buttons">
                {additive}
                <span className="mx_Dialog_buttons_row">
                    {cancelButton}
                    {this.props.children}
                    <button
                        type={this.props.primaryIsSubmit ? "submit" : "button"}
                        data-testid="dialog-primary-button"
                        className={primaryButtonClassName}
                        onClick={this.props.onPrimaryButtonClick}
                        autoFocus={this.props.focus}
                        disabled={this.props.disabled || this.props.primaryDisabled}
                    >
                        {this.props.primaryButton}
                    </button>
                </span>
            </div>
        );
    }
}
