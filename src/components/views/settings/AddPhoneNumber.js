/*
Copyright 2017 Vector Creations Ltd

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

import sdk from '../../../index';
import AddThreepid from '../../../AddThreepid';
import WithMatrixClient from '../../../wrappers/WithMatrixClient';
import Modal from '../../../Modal';


export default WithMatrixClient(React.createClass({
    displayName: 'AddPhoneNumber',

    propTypes: {
        matrixClient: React.PropTypes.object.isRequired,
        onThreepidAdded: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            busy: false,
            phoneCountry: null,
            phoneNumber: "",
            msisdn_add_pending: false,
        };
    },

    componentWillMount: function() {
        this._addThreepid = null;
        this._addMsisdnInput = null;
        this._unmounted = false;
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _onPhoneCountryChange: function(phoneCountry) {
        this.setState({ phoneCountry: phoneCountry.iso2 });
    },

    _onPhoneNumberChange: function(ev) {
        this.setState({ phoneNumber: ev.target.value });
    },

    _onAddMsisdnEditFinished: function(value, shouldSubmit) {
        if (!shouldSubmit) return;
        this._addMsisdn();
    },

    _onAddMsisdnSubmit: function(ev) {
        ev.preventDefault();
        this._addMsisdn();
    },

    _collectAddMsisdnInput: function(e) {
        this._addMsisdnInput = e;
    },

    _addMsisdn: function() {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

        this._addThreepid = new AddThreepid();
        // we always bind phone numbers when registering, so let's do the
        // same here.
        this._addThreepid.addMsisdn(this.state.phoneCountry, this.state.phoneNumber, true).then((resp) => {
            this._promptForMsisdnVerificationCode(resp.msisdn);
        }).catch((err) => {
            console.error("Unable to add phone number: " + err);
            let msg = err.message;
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: msg,
            });
        }).finally(() => {
            if (this._unmounted) return;
            this.setState({msisdn_add_pending: false});
        }).done();
        this._addMsisdnInput.blur();
        this.setState({msisdn_add_pending: true});
    },

    _promptForMsisdnVerificationCode:function (msisdn, err) {
        if (this._unmounted) return;
        const TextInputDialog = sdk.getComponent("dialogs.TextInputDialog");
        let msgElements = [
            <div key="_static" >A text message has been sent to +{msisdn}.
            Please enter the verification code it contains</div>
        ];
        if (err) {
            let msg = err.error;
            if (err.errcode == 'M_THREEPID_AUTH_FAILED') {
                msg = "Incorrect verification code";
            }
            msgElements.push(<div key="_error" className="error">{msg}</div>);
        }
        Modal.createDialog(TextInputDialog, {
            title: "Enter Code",
            description: <div>{msgElements}</div>,
            button: "Submit",
            onFinished: (should_verify, token) => {
                if (!should_verify) {
                    this._addThreepid = null;
                    return;
                }
                if (this._unmounted) return;
                this.setState({msisdn_add_pending: true});
                this._addThreepid.haveMsisdnToken(token).then(() => {
                    this._addThreepid = null;
                    this.setState({phoneNumber: ''});
                    if (this.props.onThreepidAdded) this.props.onThreepidAdded();
                }).catch((err) => {
                    this._promptForMsisdnVerificationCode(msisdn, err);
                }).finally(() => {
                    if (this._unmounted) return;
                    this.setState({msisdn_add_pending: false});
                }).done();
            }
        });
    },

    render: function() {
        const Loader = sdk.getComponent("elements.Spinner");
        if (this.state.msisdn_add_pending) {
            return <Loader />;
        } else if (this.props.matrixClient.isGuest()) {
            return <div />;
        }

        const CountryDropdown = sdk.getComponent('views.login.CountryDropdown');
        // XXX: This CSS relies on the CSS surrounding it in UserSettings as its in
        // a tabular format to align the submit buttons
        return (
            <form className="mx_UserSettings_profileTableRow" onSubmit={this._onAddMsisdnSubmit}>
                <div className="mx_UserSettings_profileLabelCell">
                </div>
                <div className="mx_UserSettings_profileInputCell">
                    <div className="mx_UserSettings_phoneSection">
                        <CountryDropdown onOptionChange={this._onPhoneCountryChange}
                            className="mx_UserSettings_phoneCountry"
                            value={this.state.phoneCountry}
                            isSmall={true}
                        />
                        <input type="text"
                            ref={this._collectAddMsisdnInput}
                            className="mx_UserSettings_phoneNumberField"
                            placeholder="Add phone number"
                            value={this.state.phoneNumber}
                            onChange={this._onPhoneNumberChange}
                        />
                    </div>
                </div>
                <div className="mx_UserSettings_threepidButton mx_filterFlipColor">
                     <input type="image" value="Add" src="img/plus.svg" width="14" height="14" />
                </div>
            </form>
        );
    }
}))
