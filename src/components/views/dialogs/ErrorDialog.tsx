/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Usage:
 * Modal.createDialog(ErrorDialog, {
 *   title: "some text", (default: "Error")
 *   description: "some more text",
 *   button: "Button Text",
 *   onFinished: someFunction,
 *   focus: true|false (default: true)
 * });
 */

import React from "react";

import { _t, UserFriendlyError } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";

/**
 * Get a user friendly error message string from a given error. Useful for the
 * `description` prop of the `ErrorDialog`
 * @param err Error object in question to extract a useful message from. To make it easy
 * to use with try/catch, this is typed as `any` because try/catch will type
 * the error as `unknown`. And in any case we can use the fallback message.
 * @param translatedFallbackMessage The fallback message to be used if the error doesn't have any message
 * @returns a user friendly error message string from a given error
 */
export function extractErrorMessageFromError(err: any, translatedFallbackMessage: string): string {
    return (
        (err instanceof UserFriendlyError && err.translatedMessage) ||
        (err instanceof Error && err.message) ||
        translatedFallbackMessage
    );
}

interface IProps {
    onFinished: (success?: boolean) => void;
    title?: string;
    description?: React.ReactNode;
    button?: string;
    focus?: boolean;
    headerImage?: string;
}

interface IState {
    onFinished: (success: boolean) => void;
}

export default class ErrorDialog extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        focus: true,
    };

    private onClick = (): void => {
        this.props.onFinished(true);
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_ErrorDialog"
                onFinished={this.props.onFinished}
                title={this.props.title || _t("common|error")}
                headerImage={this.props.headerImage}
                contentId="mx_Dialog_content"
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    {this.props.description || _t("error|dialog_description_default")}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.onClick} autoFocus={this.props.focus}>
                        {this.props.button || _t("action|ok")}
                    </button>
                </div>
            </BaseDialog>
        );
    }
}
