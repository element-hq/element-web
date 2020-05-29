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

import { _t } from "../../../../languageHandler";
import {MatrixClientPeg} from "../../../../MatrixClientPeg";
import * as sdk from '../../../../index';
import Modal from '../../../../Modal';
import AddThreepid from '../../../../AddThreepid';

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

/*
TODO: Reduce all the copying between account vs. discovery components.
*/

export class EmailAddress extends React.Component {
    static propTypes = {
        email: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);

        const { bound } = props.email;

        this.state = {
            verifying: false,
            addTask: null,
            continueDisabled: false,
            bound,
        };
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(nextProps) { // eslint-disable-line camelcase
        const { bound } = nextProps.email;
        this.setState({ bound });
    }

    async changeBinding({ bind, label, errorTitle }) {
        if (!await MatrixClientPeg.get().doesServerSupportSeparateAddAndBind()) {
            return this.changeBindingTangledAddBind({ bind, label, errorTitle });
        }

        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const { medium, address } = this.props.email;

        try {
            if (bind) {
                const task = new AddThreepid();
                this.setState({
                    verifying: true,
                    continueDisabled: true,
                    addTask: task,
                });
                await task.bindEmailAddress(address);
                this.setState({
                    continueDisabled: false,
                });
            } else {
                await MatrixClientPeg.get().unbindThreePid(medium, address);
            }
            this.setState({ bound: bind });
        } catch (err) {
            console.error(`Unable to ${label} email address ${address} ${err}`);
            this.setState({
                verifying: false,
                continueDisabled: false,
                addTask: null,
            });
            Modal.createTrackedDialog(`Unable to ${label} email address`, '', ErrorDialog, {
                title: errorTitle,
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        }
    }

    async changeBindingTangledAddBind({ bind, label, errorTitle }) {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const { medium, address } = this.props.email;

        const task = new AddThreepid();
        this.setState({
            verifying: true,
            continueDisabled: true,
            addTask: task,
        });

        try {
            await MatrixClientPeg.get().deleteThreePid(medium, address);
            if (bind) {
                await task.bindEmailAddress(address);
            } else {
                await task.addEmailAddress(address);
            }
            this.setState({
                continueDisabled: false,
                bound: bind,
            });
        } catch (err) {
            console.error(`Unable to ${label} email address ${address} ${err}`);
            this.setState({
                verifying: false,
                continueDisabled: false,
                addTask: null,
            });
            Modal.createTrackedDialog(`Unable to ${label} email address`, '', ErrorDialog, {
                title: errorTitle,
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        }
    }

    onRevokeClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.changeBinding({
            bind: false,
            label: "revoke",
            errorTitle: _t("Unable to revoke sharing for email address"),
        });
    }

    onShareClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.changeBinding({
            bind: true,
            label: "share",
            errorTitle: _t("Unable to share email address"),
        });
    }

    onContinueClick = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({ continueDisabled: true });
        try {
            await this.state.addTask.checkEmailLinkClicked();
            this.setState({
                addTask: null,
                continueDisabled: false,
                verifying: false,
            });
        } catch (err) {
            this.setState({ continueDisabled: false });
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            if (err.errcode === 'M_THREEPID_AUTH_FAILED') {
                Modal.createTrackedDialog("E-mail hasn't been verified yet", "", ErrorDialog, {
                    title: _t("Your email address hasn't been verified yet"),
                    description: _t("Click the link in the email you received to verify " +
                        "and then click continue again."),
                });
            } else {
                console.error("Unable to verify email address: " + err);
                Modal.createTrackedDialog('Unable to verify email address', '', ErrorDialog, {
                    title: _t("Unable to verify email address."),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            }
        }
    }

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const { address } = this.props.email;
        const { verifying, bound } = this.state;

        let status;
        if (verifying) {
            status = <span>
                {_t("Verify the link in your inbox")}
                <AccessibleButton
                    className="mx_ExistingEmailAddress_confirmBtn"
                    kind="primary_sm"
                    onClick={this.onContinueClick}
                >
                    {_t("Complete")}
                </AccessibleButton>
            </span>;
        } else if (bound) {
            status = <AccessibleButton
                className="mx_ExistingEmailAddress_confirmBtn"
                kind="danger_sm"
                onClick={this.onRevokeClick}
            >
                {_t("Revoke")}
            </AccessibleButton>;
        } else {
            status = <AccessibleButton
                className="mx_ExistingEmailAddress_confirmBtn"
                kind="primary_sm"
                onClick={this.onShareClick}
            >
                {_t("Share")}
            </AccessibleButton>;
        }

        return (
            <div className="mx_ExistingEmailAddress">
                <span className="mx_ExistingEmailAddress_email">{address}</span>
                {status}
            </div>
        );
    }
}

export default class EmailAddresses extends React.Component {
    static propTypes = {
        emails: PropTypes.array.isRequired,
    }

    render() {
        let content;
        if (this.props.emails.length > 0) {
            content = this.props.emails.map((e) => {
                return <EmailAddress email={e} key={e.address} />;
            });
        } else {
            content = <span className="mx_SettingsTab_subsectionText">
                {_t("Discovery options will appear once you have added an email above.")}
            </span>;
        }

        return (
            <div className="mx_EmailAddresses">
                {content}
            </div>
        );
    }
}
