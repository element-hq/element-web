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

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../../languageHandler";
import {MatrixClientPeg} from "../../../../MatrixClientPeg";
import Field from "../../elements/Field";
import AccessibleButton from "../../elements/AccessibleButton";
import AddThreepid from "../../../../AddThreepid";
import CountryDropdown from "../../auth/CountryDropdown";
import * as sdk from '../../../../index';
import Modal from '../../../../Modal';

/*
TODO: Improve the UX for everything in here.
This is a copy/paste of EmailAddresses, mostly.
 */

// TODO: Combine EmailAddresses and PhoneNumbers to be 3pid agnostic

export class ExistingPhoneNumber extends React.Component {
    static propTypes = {
        msisdn: PropTypes.object.isRequired,
        onRemoved: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            verifyRemove: false,
        };
    }

    _onRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({verifyRemove: true});
    };

    _onDontRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({verifyRemove: false});
    };

    _onActuallyRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        MatrixClientPeg.get().deleteThreePid(this.props.msisdn.medium, this.props.msisdn.address).then(() => {
            return this.props.onRemoved(this.props.msisdn);
        }).catch((err) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Unable to remove contact information: " + err);
            Modal.createTrackedDialog('Remove 3pid failed', '', ErrorDialog, {
                title: _t("Unable to remove contact information"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    };

    render() {
        if (this.state.verifyRemove) {
            return (
                <div className="mx_ExistingPhoneNumber">
                    <span className="mx_ExistingPhoneNumber_promptText">
                        {_t("Remove %(phone)s?", {phone: this.props.msisdn.address})}
                    </span>
                    <AccessibleButton onClick={this._onActuallyRemove} kind="danger_sm"
                                      className="mx_ExistingPhoneNumber_confirmBtn">
                        {_t("Remove")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this._onDontRemove} kind="link_sm"
                                      className="mx_ExistingPhoneNumber_confirmBtn">
                        {_t("Cancel")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_ExistingPhoneNumber">
                <span className="mx_ExistingPhoneNumber_address">+{this.props.msisdn.address}</span>
                <AccessibleButton onClick={this._onRemove} kind="danger_sm">
                    {_t("Remove")}
                </AccessibleButton>
            </div>
        );
    }
}

export default class PhoneNumbers extends React.Component {
    static propTypes = {
        msisdns: PropTypes.array.isRequired,
        onMsisdnsChange: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            verifying: false,
            verifyError: false,
            verifyMsisdn: "",
            addTask: null,
            continueDisabled: false,
            phoneCountry: "",
            newPhoneNumber: "",
            newPhoneNumberCode: "",
        };
    }

    _onRemoved = (address) => {
        const msisdns = this.props.msisdns.filter((e) => e !== address);
        this.props.onMsisdnsChange(msisdns);
    };

    _onChangeNewPhoneNumber = (e) => {
        this.setState({
            newPhoneNumber: e.target.value,
        });
    };

    _onChangeNewPhoneNumberCode = (e) => {
        this.setState({
            newPhoneNumberCode: e.target.value,
        });
    };

    _onAddClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.newPhoneNumber) return;

        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const phoneNumber = this.state.newPhoneNumber;
        const phoneCountry = this.state.phoneCountry;

        const task = new AddThreepid();
        this.setState({verifying: true, continueDisabled: true, addTask: task});

        task.addMsisdn(phoneCountry, phoneNumber).then((response) => {
            this.setState({continueDisabled: false, verifyMsisdn: response.msisdn});
        }).catch((err) => {
            console.error("Unable to add phone number " + phoneNumber + " " + err);
            this.setState({verifying: false, continueDisabled: false, addTask: null});
            Modal.createTrackedDialog('Add Phone Number Error', '', ErrorDialog, {
                title: _t("Error"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    };

    _onContinueClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({continueDisabled: true});
        const token = this.state.newPhoneNumberCode;
        const address = this.state.verifyMsisdn;
        this.state.addTask.haveMsisdnToken(token).then(() => {
            this.setState({
                addTask: null,
                continueDisabled: false,
                verifying: false,
                verifyMsisdn: "",
                verifyError: null,
                newPhoneNumber: "",
                newPhoneNumberCode: "",
            });
            const msisdns = [
                ...this.props.msisdns,
                { address, medium: "msisdn" },
            ];
            this.props.onMsisdnsChange(msisdns);
        }).catch((err) => {
            this.setState({continueDisabled: false});
            if (err.errcode !== 'M_THREEPID_AUTH_FAILED') {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                console.error("Unable to verify phone number: " + err);
                Modal.createTrackedDialog('Unable to verify phone number', '', ErrorDialog, {
                    title: _t("Unable to verify phone number."),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            } else {
                this.setState({verifyError: _t("Incorrect verification code")});
            }
        });
    };

    _onCountryChanged = (e) => {
        this.setState({phoneCountry: e.iso2});
    };

    render() {
        const existingPhoneElements = this.props.msisdns.map((p) => {
            return <ExistingPhoneNumber msisdn={p} onRemoved={this._onRemoved} key={p.address} />;
        });

        let addVerifySection = (
            <AccessibleButton onClick={this._onAddClick} kind="primary">
                {_t("Add")}
            </AccessibleButton>
        );
        if (this.state.verifying) {
            const msisdn = this.state.verifyMsisdn;
            addVerifySection = (
                <div>
                    <div>
                        {_t("A text message has been sent to +%(msisdn)s. " +
                            "Please enter the verification code it contains.", { msisdn: msisdn })}
                        <br />
                        {this.state.verifyError}
                    </div>
                    <form onSubmit={this._onContinueClick} autoComplete="off" noValidate={true}>
                        <Field
                            type="text"
                            label={_t("Verification code")}
                            autoComplete="off"
                            disabled={this.state.continueDisabled}
                            value={this.state.newPhoneNumberCode}
                            onChange={this._onChangeNewPhoneNumberCode}
                        />
                        <AccessibleButton onClick={this._onContinueClick} kind="primary"
                                          disabled={this.state.continueDisabled}>
                            {_t("Continue")}
                        </AccessibleButton>
                    </form>
                </div>
            );
        }

        const phoneCountry = <CountryDropdown onOptionChange={this._onCountryChanged}
            className="mx_PhoneNumbers_country"
            value={this.state.phoneCountry}
            disabled={this.state.verifying}
            isSmall={true}
            showPrefix={true}
        />;

        return (
            <div className="mx_PhoneNumbers">
                {existingPhoneElements}
                <form onSubmit={this._onAddClick} autoComplete="off" noValidate={true} className="mx_PhoneNumbers_new">
                    <div className="mx_PhoneNumbers_input">
                        <Field
                            type="text"
                            label={_t("Phone Number")}
                            autoComplete="off"
                            disabled={this.state.verifying}
                            prefixComponent={phoneCountry}
                            value={this.state.newPhoneNumber}
                            onChange={this._onChangeNewPhoneNumber}
                        />
                    </div>
                </form>
                {addVerifySection}
            </div>
        );
    }
}
