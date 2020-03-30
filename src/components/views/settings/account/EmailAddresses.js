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
import * as Email from "../../../../email";
import AddThreepid from "../../../../AddThreepid";
import * as sdk from '../../../../index';
import Modal from '../../../../Modal';

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

export class ExistingEmailAddress extends React.Component {
    static propTypes = {
        email: PropTypes.object.isRequired,
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

        MatrixClientPeg.get().deleteThreePid(this.props.email.medium, this.props.email.address).then(() => {
            return this.props.onRemoved(this.props.email);
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
                <div className="mx_ExistingEmailAddress">
                    <span className="mx_ExistingEmailAddress_promptText">
                        {_t("Remove %(email)s?", {email: this.props.email.address} )}
                    </span>
                    <AccessibleButton onClick={this._onActuallyRemove} kind="danger_sm"
                                      className="mx_ExistingEmailAddress_confirmBtn">
                        {_t("Remove")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this._onDontRemove} kind="link_sm"
                                      className="mx_ExistingEmailAddress_confirmBtn">
                        {_t("Cancel")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_ExistingEmailAddress">
                <span className="mx_ExistingEmailAddress_email">{this.props.email.address}</span>
                <AccessibleButton onClick={this._onRemove} kind="danger_sm">
                    {_t("Remove")}
                </AccessibleButton>
            </div>
        );
    }
}

export default class EmailAddresses extends React.Component {
    static propTypes = {
        emails: PropTypes.array.isRequired,
        onEmailsChange: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            verifying: false,
            addTask: null,
            continueDisabled: false,
            newEmailAddress: "",
        };
    }

    _onRemoved = (address) => {
        const emails = this.props.emails.filter((e) => e !== address);
        this.props.onEmailsChange(emails);
    };

    _onChangeNewEmailAddress = (e) => {
        this.setState({
            newEmailAddress: e.target.value,
        });
    };

    _onAddClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.newEmailAddress) return;

        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const email = this.state.newEmailAddress;

        // TODO: Inline field validation
        if (!Email.looksValid(email)) {
            Modal.createTrackedDialog('Invalid email address', '', ErrorDialog, {
                title: _t("Invalid Email Address"),
                description: _t("This doesn't appear to be a valid email address"),
            });
            return;
        }

        const task = new AddThreepid();
        this.setState({verifying: true, continueDisabled: true, addTask: task});

        task.addEmailAddress(email).then(() => {
            this.setState({continueDisabled: false});
        }).catch((err) => {
            console.error("Unable to add email address " + email + " " + err);
            this.setState({verifying: false, continueDisabled: false, addTask: null});
            Modal.createTrackedDialog('Unable to add email address', '', ErrorDialog, {
                title: _t("Unable to add email address"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    };

    _onContinueClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({continueDisabled: true});
        this.state.addTask.checkEmailLinkClicked().then(() => {
            const email = this.state.newEmailAddress;
            this.setState({
                addTask: null,
                continueDisabled: false,
                verifying: false,
                newEmailAddress: "",
            });
            const emails = [
                ...this.props.emails,
                { address: email, medium: "email" },
            ];
            this.props.onEmailsChange(emails);
        }).catch((err) => {
            this.setState({continueDisabled: false});
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            if (err.errcode === 'M_THREEPID_AUTH_FAILED') {
                Modal.createTrackedDialog("Email hasn't been verified yet", "", ErrorDialog, {
                    title: _t("Your email address hasn't been verified yet"),
                    description: _t("Click the link in the email you received to verify " +
                        "and then click continue again."),
                });
            } else {
                console.error("Unable to verify email address: ", err);
                Modal.createTrackedDialog('Unable to verify email address', '', ErrorDialog, {
                    title: _t("Unable to verify email address."),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            }
        });
    };

    render() {
        const existingEmailElements = this.props.emails.map((e) => {
            return <ExistingEmailAddress email={e} onRemoved={this._onRemoved} key={e.address} />;
        });

        let addButton = (
            <AccessibleButton onClick={this._onAddClick} kind="primary">
                {_t("Add")}
            </AccessibleButton>
        );
        if (this.state.verifying) {
            addButton = (
              <div>
                  <div>{_t("We've sent you an email to verify your address. Please follow the instructions there and then click the button below.")}</div>
                  <AccessibleButton onClick={this._onContinueClick} kind="primary"
                                    disabled={this.state.continueDisabled}>
                      {_t("Continue")}
                  </AccessibleButton>
              </div>
            );
        }

        return (
            <div className="mx_EmailAddresses">
                {existingEmailElements}
                <form onSubmit={this._onAddClick} autoComplete="off"
                      noValidate={true} className="mx_EmailAddresses_new">
                    <Field
                        type="text"
                        label={_t("Email Address")}
                        autoComplete="off"
                        disabled={this.state.verifying}
                        value={this.state.newEmailAddress}
                        onChange={this._onChangeNewEmailAddress}
                    />
                    {addButton}
                </form>
            </div>
        );
    }
}
