/*
Copyright 2018-2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
                title: _t("settings|general|error_invalid_email"),
                description: _t("settings|general|error_invalid_email_detail"),
            });
            return;
        }
        this.addThreepid = new AddThreepid(MatrixClientPeg.safeGet());
        this.addThreepid.addEmailAddress(emailAddress).then(
            () => {
                Modal.createDialog(QuestionDialog, {
                    title: _t("auth|set_email|verification_pending_title"),
                    description: _t("auth|set_email|verification_pending_description"),
                    button: _t("action|continue"),
                    onFinished: this.onEmailDialogFinished,
                });
            },
            (err) => {
                this.setState({ emailBusy: false });
                logger.error("Unable to add email address " + emailAddress + " " + err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("settings|general|error_add_email"),
                    description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
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
                        _t("settings|general|error_email_verification") +
                        " " +
                        _t("auth|set_email|verification_pending_description");
                    Modal.createDialog(QuestionDialog, {
                        title: _t("auth|set_email|verification_pending_title"),
                        description: message,
                        button: _t("action|continue"),
                        onFinished: this.onEmailDialogFinished,
                    });
                } else {
                    logger.error("Unable to verify email address: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|general|error_email_verification"),
                        description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
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
                placeholder={_t("common|email_address")}
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
                    <p id="mx_Dialog_content">{_t("auth|set_email|description")}</p>
                    {emailInput}
                </div>
                <div className="mx_Dialog_buttons">
                    <input
                        className="mx_Dialog_primary"
                        type="submit"
                        value={_t("action|continue")}
                        onClick={this.onSubmit}
                    />
                    <input type="submit" value={_t("action|skip")} onClick={this.onCancelled} />
                </div>
            </BaseDialog>
        );
    }
}
