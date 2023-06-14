/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd.

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

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

export interface IQuestionDialogProps {
    title?: string;
    description?: React.ReactNode;
    extraButtons?: React.ReactNode;
    button?: string;
    buttonDisabled?: boolean;
    danger?: boolean;
    focus?: boolean;
    headerImage?: string;
    quitOnly?: boolean; // quitOnly doesn't show the cancel button just the quit [x].
    fixedWidth?: boolean;
    className?: string;
    hasCancelButton?: boolean;
    cancelButton?: React.ReactNode;
    onFinished(ok?: boolean): void;
}

export default class QuestionDialog extends React.Component<IQuestionDialogProps> {
    public static defaultProps: Partial<IQuestionDialogProps> = {
        title: "",
        description: "",
        extraButtons: null,
        focus: true,
        hasCancelButton: true,
        danger: false,
        quitOnly: false,
    };

    private onOk = (): void => {
        this.props.onFinished(true);
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    public render(): React.ReactNode {
        let primaryButtonClass = "";
        if (this.props.danger) {
            primaryButtonClass = "danger";
        }
        return (
            <BaseDialog
                className={classNames("mx_QuestionDialog", this.props.className)}
                onFinished={this.props.onFinished}
                title={this.props.title}
                contentId="mx_Dialog_content"
                headerImage={this.props.headerImage}
                hasCancel={this.props.hasCancelButton}
                fixedWidth={this.props.fixedWidth}
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    {this.props.description}
                </div>
                <DialogButtons
                    primaryButton={this.props.button || _t("OK")}
                    primaryButtonClass={primaryButtonClass}
                    primaryDisabled={this.props.buttonDisabled}
                    cancelButton={this.props.cancelButton}
                    hasCancel={this.props.hasCancelButton && !this.props.quitOnly}
                    onPrimaryButtonClick={this.onOk}
                    focus={this.props.focus}
                    onCancel={this.onCancel}
                >
                    {this.props.extraButtons}
                </DialogButtons>
            </BaseDialog>
        );
    }
}
