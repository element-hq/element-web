/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import { ThreepidMedium, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, UserFriendlyError } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import Field from "../../elements/Field";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";
import * as Email from "../../../../email";
import AddThreepid, { ThirdPartyIdentifier } from "../../../../AddThreepid";
import Modal from "../../../../Modal";
import ErrorDialog, { extractErrorMessageFromError } from "../../dialogs/ErrorDialog";

/*
TODO: Improve the UX for everything in here.
It's very much placeholder, but it gets the job done. The old way of handling
email addresses in user settings was to use dialogs to communicate state, however
due to our dialog system overriding dialogs (causing unmounts) this creates problems
for a sane UX. For instance, the user could easily end up entering an email address
and receive a dialog to verify the address, which then causes the component here
to forget what it was doing and ultimately fail. Dialogs are still used in some
places to communicate errors - these should be replaced with inline validation when
that is available.
 */

interface IExistingEmailAddressProps {
    email: ThirdPartyIdentifier;
    onRemoved: (emails: ThirdPartyIdentifier) => void;
    /**
     * Disallow removal of this email address when truthy
     */
    disabled?: boolean;
}

interface IExistingEmailAddressState {
    verifyRemove: boolean;
}

export class ExistingEmailAddress extends React.Component<IExistingEmailAddressProps, IExistingEmailAddressState> {
    public constructor(props: IExistingEmailAddressProps) {
        super(props);

        this.state = {
            verifyRemove: false,
        };
    }

    private onRemove = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({ verifyRemove: true });
    };

    private onDontRemove = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({ verifyRemove: false });
    };

    private onActuallyRemove = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        MatrixClientPeg.safeGet()
            .deleteThreePid(this.props.email.medium, this.props.email.address)
            .then(() => {
                return this.props.onRemoved(this.props.email);
            })
            .catch((err) => {
                logger.error("Unable to remove contact information: " + err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("settings|general|error_remove_3pid"),
                    description: err && err.message ? err.message : _t("invite|failed_generic"),
                });
            });
    };

    public render(): React.ReactNode {
        if (this.state.verifyRemove) {
            return (
                <div className="mx_GeneralUserSettingsTab_section--discovery_existing">
                    <span className="mx_GeneralUserSettingsTab_section--discovery_existing_promptText">
                        {_t("settings|general|remove_email_prompt", { email: this.props.email.address })}
                    </span>
                    <AccessibleButton
                        onClick={this.onActuallyRemove}
                        kind="danger_sm"
                        className="mx_GeneralUserSettingsTab_section--discovery_existing_button"
                    >
                        {_t("action|remove")}
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={this.onDontRemove}
                        kind="link_sm"
                        className="mx_GeneralUserSettingsTab_section--discovery_existing_button"
                    >
                        {_t("action|cancel")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_GeneralUserSettingsTab_section--discovery_existing">
                <span className="mx_GeneralUserSettingsTab_section--discovery_existing_address">
                    {this.props.email.address}
                </span>
                <AccessibleButton onClick={this.onRemove} kind="danger_sm" disabled={this.props.disabled}>
                    {_t("action|remove")}
                </AccessibleButton>
            </div>
        );
    }
}

interface IProps {
    emails: ThirdPartyIdentifier[];
    onEmailsChange: (emails: ThirdPartyIdentifier[]) => void;
    /**
     * Adding or removing emails is disabled when truthy
     */
    disabled?: boolean;
}

interface IState {
    verifying: boolean;
    addTask: AddThreepid | null;
    continueDisabled: boolean;
    newEmailAddress: string;
}

export default class EmailAddresses extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            verifying: false,
            addTask: null,
            continueDisabled: false,
            newEmailAddress: "",
        };
    }

    private onRemoved = (address: ThirdPartyIdentifier): void => {
        const emails = this.props.emails.filter((e) => e !== address);
        this.props.onEmailsChange(emails);
    };

    private onChangeNewEmailAddress = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            newEmailAddress: e.target.value,
        });
    };

    private onAddClick = (e: React.FormEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.newEmailAddress) return;

        const email = this.state.newEmailAddress;

        // TODO: Inline field validation
        if (!Email.looksValid(email)) {
            Modal.createDialog(ErrorDialog, {
                title: _t("settings|general|error_invalid_email"),
                description: _t("settings|general|error_invalid_email_detail"),
            });
            return;
        }

        const task = new AddThreepid(MatrixClientPeg.safeGet());
        this.setState({ verifying: true, continueDisabled: true, addTask: task });

        task.addEmailAddress(email)
            .then(() => {
                this.setState({ continueDisabled: false });
            })
            .catch((err) => {
                logger.error("Unable to add email address " + email + " " + err);
                this.setState({ verifying: false, continueDisabled: false, addTask: null });
                Modal.createDialog(ErrorDialog, {
                    title: _t("settings|general|error_add_email"),
                    description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                });
            });
    };

    private onContinueClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({ continueDisabled: true });
        this.state.addTask
            ?.checkEmailLinkClicked()
            .then(([finished]) => {
                let newEmailAddress = this.state.newEmailAddress;
                if (finished) {
                    const email = this.state.newEmailAddress;
                    const emails = [...this.props.emails, { address: email, medium: ThreepidMedium.Email }];
                    this.props.onEmailsChange(emails);
                    newEmailAddress = "";
                }
                this.setState({
                    addTask: null,
                    continueDisabled: false,
                    verifying: false,
                    newEmailAddress,
                });
            })
            .catch((err) => {
                logger.error("Unable to verify email address: ", err);

                this.setState({ continueDisabled: false });

                let underlyingError = err;
                if (err instanceof UserFriendlyError) {
                    underlyingError = err.cause;
                }

                if (underlyingError instanceof MatrixError && underlyingError.errcode === "M_THREEPID_AUTH_FAILED") {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|general|email_not_verified"),
                        description: _t("settings|general|email_verification_instructions"),
                    });
                } else {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|general|error_email_verification"),
                        description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                    });
                }
            });
    };

    public render(): React.ReactNode {
        const existingEmailElements = this.props.emails.map((e) => {
            return (
                <ExistingEmailAddress
                    email={e}
                    onRemoved={this.onRemoved}
                    key={e.address}
                    disabled={this.props.disabled}
                />
            );
        });

        let addButton = (
            <AccessibleButton onClick={this.onAddClick} kind="primary" disabled={this.props.disabled}>
                {_t("action|add")}
            </AccessibleButton>
        );
        if (this.state.verifying) {
            addButton = (
                <div>
                    <div>{_t("settings|general|add_email_instructions")}</div>
                    <AccessibleButton
                        onClick={this.onContinueClick}
                        kind="primary"
                        disabled={this.state.continueDisabled}
                    >
                        {_t("action|continue")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <>
                {existingEmailElements}
                <form onSubmit={this.onAddClick} autoComplete="off" noValidate={true}>
                    <Field
                        type="text"
                        label={_t("settings|general|email_address_label")}
                        autoComplete="email"
                        disabled={this.props.disabled || this.state.verifying}
                        value={this.state.newEmailAddress}
                        onChange={this.onChangeNewEmailAddress}
                    />
                    {addButton}
                </form>
            </>
        );
    }
}
