/*
Copyright 2015, 2016 OpenMarket Ltd

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
                title={this.props.title || _t("Error")}
                headerImage={this.props.headerImage}
                contentId="mx_Dialog_content"
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    {this.props.description || _t("An error has occurred.")}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.onClick} autoFocus={this.props.focus}>
                        {this.props.button || _t("OK")}
                    </button>
                </div>
            </BaseDialog>
        );
    }
}
