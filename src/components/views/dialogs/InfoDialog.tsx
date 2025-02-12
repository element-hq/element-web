/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Bastian Masanek, Noxware IT <matrix@noxware.de>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    top?: ReactNode;
    title?: string;
    description?: ReactNode;
    className?: string;
    button?: boolean | string;
    hasCloseButton?: boolean;
    fixedWidth?: boolean;
    onKeyDown?(event: KeyboardEvent | React.KeyboardEvent): void;
    onFinished(): void;
}

export default class InfoDialog extends React.Component<IProps> {
    public static defaultProps: Partial<IProps> = {
        title: "",
        description: "",
        hasCloseButton: false,
    };

    private onFinished = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_InfoDialog"
                onFinished={this.props.onFinished}
                top={this.props.top}
                title={this.props.title}
                contentId="mx_Dialog_content"
                hasCancel={this.props.hasCloseButton}
                onKeyDown={this.props.onKeyDown}
                fixedWidth={this.props.fixedWidth}
            >
                <div className={classNames("mx_Dialog_content", this.props.className)} id="mx_Dialog_content">
                    {this.props.description}
                </div>
                {this.props.button !== false && (
                    <DialogButtons
                        primaryButton={this.props.button || _t("action|ok")}
                        onPrimaryButtonClick={this.onFinished}
                        hasCancel={false}
                    />
                )}
            </BaseDialog>
        );
    }
}
