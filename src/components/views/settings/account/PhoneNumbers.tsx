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
import { IAuthData, ThreepidMedium } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, UserFriendlyError } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import Field from "../../elements/Field";
import AccessibleButton, { ButtonEvent } from "../../elements/AccessibleButton";
import AddThreepid, { ThirdPartyIdentifier } from "../../../../AddThreepid";
import CountryDropdown from "../../auth/CountryDropdown";
import Modal from "../../../../Modal";
import ErrorDialog, { extractErrorMessageFromError } from "../../dialogs/ErrorDialog";
import { PhoneNumberCountryDefinition } from "../../../../phonenumber";

/*
TODO: Improve the UX for everything in here.
This is a copy/paste of EmailAddresses, mostly.
 */

// TODO: Combine EmailAddresses and PhoneNumbers to be 3pid agnostic

interface IExistingPhoneNumberProps {
    msisdn: ThirdPartyIdentifier;
    onRemoved: (phoneNumber: ThirdPartyIdentifier) => void;
    /**
     * Disable removing phone number
     */
    disabled?: boolean;
}

interface IExistingPhoneNumberState {
    verifyRemove: boolean;
}

export class ExistingPhoneNumber extends React.Component<IExistingPhoneNumberProps, IExistingPhoneNumberState> {
    public constructor(props: IExistingPhoneNumberProps) {
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
            .deleteThreePid(this.props.msisdn.medium, this.props.msisdn.address)
            .then(() => {
                return this.props.onRemoved(this.props.msisdn);
            })
            .catch((err) => {
                logger.error("Unable to remove contact information: " + err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("settings|general|error_remove_3pid"),
                    description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                });
            });
    };

    public render(): React.ReactNode {
        if (this.state.verifyRemove) {
            return (
                <div className="mx_GeneralUserSettingsTab_section--discovery_existing">
                    <span className="mx_GeneralUserSettingsTab_section--discovery_existing_promptText">
                        {_t("settings|general|remove_msisdn_prompt", { phone: this.props.msisdn.address })}
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
                    +{this.props.msisdn.address}
                </span>
                <AccessibleButton onClick={this.onRemove} kind="danger_sm" disabled={this.props.disabled}>
                    {_t("action|remove")}
                </AccessibleButton>
            </div>
        );
    }
}

interface IProps {
    msisdns: ThirdPartyIdentifier[];
    onMsisdnsChange: (phoneNumbers: ThirdPartyIdentifier[]) => void;
    /**
     * Adding or removing phone numbers is disabled when truthy
     */
    disabled?: boolean;
}

interface IState {
    verifying: boolean;
    verifyError: string | null;
    verifyMsisdn: string;
    addTask: AddThreepid | null;
    continueDisabled: boolean;
    phoneCountry: string;
    newPhoneNumber: string;
    newPhoneNumberCode: string;
}

export default class PhoneNumbers extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            verifying: false,
            verifyError: null,
            verifyMsisdn: "",
            addTask: null,
            continueDisabled: false,
            phoneCountry: "",
            newPhoneNumber: "",
            newPhoneNumberCode: "",
        };
    }

    private onRemoved = (address: ThirdPartyIdentifier): void => {
        const msisdns = this.props.msisdns.filter((e) => e !== address);
        this.props.onMsisdnsChange(msisdns);
    };

    private onChangeNewPhoneNumber = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            newPhoneNumber: e.target.value,
        });
    };

    private onChangeNewPhoneNumberCode = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            newPhoneNumberCode: e.target.value,
        });
    };

    private onAddClick = (e: ButtonEvent | React.FormEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.newPhoneNumber) return;

        const phoneNumber = this.state.newPhoneNumber;
        const phoneCountry = this.state.phoneCountry;

        const task = new AddThreepid(MatrixClientPeg.safeGet());
        this.setState({ verifying: true, continueDisabled: true, addTask: task });

        task.addMsisdn(phoneCountry, phoneNumber)
            .then((response) => {
                this.setState({ continueDisabled: false, verifyMsisdn: response.msisdn });
            })
            .catch((err) => {
                logger.error("Unable to add phone number " + phoneNumber + " " + err);
                this.setState({ verifying: false, continueDisabled: false, addTask: null });
                Modal.createDialog(ErrorDialog, {
                    title: _t("common|error"),
                    description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                });
            });
    };

    private onContinueClick = (e: ButtonEvent | React.FormEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({ continueDisabled: true });
        const token = this.state.newPhoneNumberCode;
        const address = this.state.verifyMsisdn;
        this.state.addTask
            ?.haveMsisdnToken(token)
            .then(([finished]: [success?: boolean, result?: IAuthData | Error | null] = []) => {
                let newPhoneNumber = this.state.newPhoneNumber;
                if (finished !== false) {
                    const msisdns = [...this.props.msisdns, { address, medium: ThreepidMedium.Phone }];
                    this.props.onMsisdnsChange(msisdns);
                    newPhoneNumber = "";
                }
                this.setState({
                    addTask: null,
                    continueDisabled: false,
                    verifying: false,
                    verifyMsisdn: "",
                    verifyError: null,
                    newPhoneNumber,
                    newPhoneNumberCode: "",
                });
            })
            .catch((err) => {
                logger.error("Unable to verify phone number: " + err);
                this.setState({ continueDisabled: false });

                let underlyingError = err;
                if (err instanceof UserFriendlyError) {
                    underlyingError = err.cause;
                }

                if (underlyingError.errcode !== "M_THREEPID_AUTH_FAILED") {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|general|error_msisdn_verification"),
                        description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                    });
                } else {
                    this.setState({ verifyError: _t("settings|general|incorrect_msisdn_verification") });
                }
            });
    };

    private onCountryChanged = (country: PhoneNumberCountryDefinition): void => {
        this.setState({ phoneCountry: country.iso2 });
    };

    public render(): React.ReactNode {
        const existingPhoneElements = this.props.msisdns.map((p) => {
            return (
                <ExistingPhoneNumber
                    msisdn={p}
                    onRemoved={this.onRemoved}
                    key={p.address}
                    disabled={this.props.disabled}
                />
            );
        });

        let addVerifySection = (
            <AccessibleButton onClick={this.onAddClick} kind="primary" disabled={this.props.disabled}>
                {_t("action|add")}
            </AccessibleButton>
        );
        if (this.state.verifying) {
            const msisdn = this.state.verifyMsisdn;
            addVerifySection = (
                <div>
                    <div>
                        {_t("settings|general|add_msisdn_instructions", { msisdn: msisdn })}
                        <br />
                        {this.state.verifyError}
                    </div>
                    <form onSubmit={this.onContinueClick} autoComplete="off" noValidate={true}>
                        <Field
                            type="text"
                            label={_t("settings|general|msisdn_verification_field_label")}
                            autoComplete="off"
                            disabled={this.props.disabled || this.state.continueDisabled}
                            value={this.state.newPhoneNumberCode}
                            onChange={this.onChangeNewPhoneNumberCode}
                        />
                        <AccessibleButton
                            onClick={this.onContinueClick}
                            kind="primary"
                            disabled={
                                this.props.disabled ||
                                this.state.continueDisabled ||
                                this.state.newPhoneNumberCode.length === 0
                            }
                        >
                            {_t("action|continue")}
                        </AccessibleButton>
                    </form>
                </div>
            );
        }

        const phoneCountry = (
            <CountryDropdown
                onOptionChange={this.onCountryChanged}
                className="mx_PhoneNumbers_country"
                value={this.state.phoneCountry}
                disabled={this.state.verifying}
                isSmall={true}
                showPrefix={true}
            />
        );

        return (
            <>
                {existingPhoneElements}
                <form onSubmit={this.onAddClick} autoComplete="off" noValidate={true} className="mx_PhoneNumbers_new">
                    <div className="mx_PhoneNumbers_input">
                        <Field
                            type="text"
                            label={_t("settings|general|msisdn_label")}
                            autoComplete="tel-national"
                            disabled={this.props.disabled || this.state.verifying}
                            prefixComponent={phoneCountry}
                            value={this.state.newPhoneNumber}
                            onChange={this.onChangeNewPhoneNumber}
                        />
                    </div>
                </form>
                {addVerifySection}
            </>
        );
    }
}
