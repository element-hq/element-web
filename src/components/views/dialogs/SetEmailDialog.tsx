/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixError } from "matrix-js-sdk/src/matrix";

import * as Email from "../../../email";
import AddThreepid from "../../../AddThreepid";
import { _t, UserFriendlyError } from "../../../languageHandler";
import Modal from "../../../Modal";
import Spinner from "../elements/Spinner";
import ErrorDialog, { extractErrorMessageFromError } from "./ErrorDialog";
import QuestionDialog from "./QuestionDialog";
import BaseDialog from "./BaseDialog";
import EditableText from "../elements/EditableText";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    title: string;
    onFinished(ok?: boolean): void;
}

interface IState {
    emailAddress: string;
    emailBusy: boolean;
}

/*
 * Prompt the user to set an email address.
 *
 * On success, `onFinished(true)` is called.
 */
export default class SetEmailDialog extends React.Component<IProps, IState> {
    private addThreepid?: AddThreepid;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            emailAddress: "",
            emailBusy: false,
        };
    }

    private onEmailAddressChanged = (value: string): void => {
        this.setState({
            emailAddress: value,
        });
    };

    private onSubmit = (): void => {
        const emailAddress = this.state.emailAddress;
        if (!Email.looksValid(emailAddress)) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Invalid Email Address"),
                description: _t("This doesn't appear to be a valid email address"),
            });
            return;
        }
        this.addThreepid = new AddThreepid(MatrixClientPeg.get());
        this.addThreepid.addEmailAddress(emailAddress).then(
            () => {
                Modal.createDialog(QuestionDialog, {
                    title: _t("Verification Pending"),
                    description: _t(
                        "Please check your email and click on the link it contains. Once this " +
                            "is done, click continue.",
                    ),
                    button: _t("Continue"),
                    onFinished: this.onEmailDialogFinished,
                });
            },
            (err) => {
                this.setState({ emailBusy: false });
                logger.error("Unable to add email address " + emailAddress + " " + err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Unable to add email address"),
                    description: extractErrorMessageFromError(err, _t("Operation failed")),
                });
            },
        );
        this.setState({ emailBusy: true });
    };

    private onCancelled = (): void => {
        this.props.onFinished(false);
    };

    private onEmailDialogFinished = (ok: boolean): void => {
        if (ok) {
            this.verifyEmailAddress();
        } else {
            this.setState({ emailBusy: false });
        }
    };

    private verifyEmailAddress(): void {
        this.addThreepid?.checkEmailLinkClicked().then(
            () => {
                this.props.onFinished(true);
            },
            (err) => {
                this.setState({ emailBusy: false });

                let underlyingError = err;
                if (err instanceof UserFriendlyError) {
                    underlyingError = err.cause;
                }

                if (underlyingError instanceof MatrixError && underlyingError.errcode === "M_THREEPID_AUTH_FAILED") {
                    const message =
                        _t("Unable to verify email address.") +
                        " " +
                        _t(
                            "Please check your email and click on the link it contains. Once this is done, click continue.",
                        );
                    Modal.createDialog(QuestionDialog, {
                        title: _t("Verification Pending"),
                        description: message,
                        button: _t("Continue"),
                        onFinished: this.onEmailDialogFinished,
                    });
                } else {
                    logger.error("Unable to verify email address: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Unable to verify email address."),
                        description: extractErrorMessageFromError(err, _t("Operation failed")),
                    });
                }
            },
        );
    }

    public render(): React.ReactNode {
        const emailInput = this.state.emailBusy ? (
            <Spinner />
        ) : (
            <EditableText
                initialValue={this.state.emailAddress}
                className="mx_SetEmailDialog_email_input"
                placeholder={_t("Email address")}
                placeholderClassName="mx_SetEmailDialog_email_input_placeholder"
                blurToCancel={false}
                onValueChanged={this.onEmailAddressChanged}
            />
        );

        return (
            <BaseDialog
                className="mx_SetEmailDialog"
                onFinished={this.onCancelled}
                title={this.props.title}
                contentId="mx_Dialog_content"
            >
                <div className="mx_Dialog_content">
                    <p id="mx_Dialog_content">
                        {_t("This will allow you to reset your password and receive notifications.")}
                    </p>
                    {emailInput}
                </div>
                <div className="mx_Dialog_buttons">
                    <input className="mx_Dialog_primary" type="submit" value={_t("Continue")} onClick={this.onSubmit} />
                    <input type="submit" value={_t("Skip")} onClick={this.onCancelled} />
                </div>
            </BaseDialog>
        );
    }
}
