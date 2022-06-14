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
import { IThreepid } from "matrix-js-sdk/src/@types/threepids";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import Modal from '../../../../Modal';
import AddThreepid from '../../../../AddThreepid';
import ErrorDialog from "../../dialogs/ErrorDialog";
import Field from "../../elements/Field";
import AccessibleButton from "../../elements/AccessibleButton";

/*
TODO: Improve the UX for everything in here.
This is a copy/paste of EmailAddresses, mostly.
 */

// TODO: Combine EmailAddresses and PhoneNumbers to be 3pid agnostic

interface IPhoneNumberProps {
    msisdn: IThreepid;
}

interface IPhoneNumberState {
    verifying: boolean;
    verificationCode: string;
    addTask: any; // FIXME: When AddThreepid is TSfied
    continueDisabled: boolean;
    bound: boolean;
    verifyError: string;
}

export class PhoneNumber extends React.Component<IPhoneNumberProps, IPhoneNumberState> {
    constructor(props: IPhoneNumberProps) {
        super(props);

        const { bound } = props.msisdn;

        this.state = {
            verifying: false,
            verificationCode: "",
            addTask: null,
            continueDisabled: false,
            bound,
            verifyError: null,
        };
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
    public UNSAFE_componentWillReceiveProps(nextProps: IPhoneNumberProps): void {
        const { bound } = nextProps.msisdn;
        this.setState({ bound });
    }

    private async changeBinding({ bind, label, errorTitle }): Promise<void> {
        if (!(await MatrixClientPeg.get().doesServerSupportSeparateAddAndBind())) {
            return this.changeBindingTangledAddBind({ bind, label, errorTitle });
        }

        const { medium, address } = this.props.msisdn;

        try {
            if (bind) {
                const task = new AddThreepid();
                this.setState({
                    verifying: true,
                    continueDisabled: true,
                    addTask: task,
                });
                // XXX: Sydent will accept a number without country code if you add
                // a leading plus sign to a number in E.164 format (which the 3PID
                // address is), but this goes against the spec.
                // See https://github.com/matrix-org/matrix-doc/issues/2222
                await task.bindMsisdn(null, `+${address}`);
                this.setState({
                    continueDisabled: false,
                });
            } else {
                await MatrixClientPeg.get().unbindThreePid(medium, address);
            }
            this.setState({ bound: bind });
        } catch (err) {
            logger.error(`Unable to ${label} phone number ${address} ${err}`);
            this.setState({
                verifying: false,
                continueDisabled: false,
                addTask: null,
            });
            Modal.createDialog(ErrorDialog, {
                title: errorTitle,
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        }
    }

    private async changeBindingTangledAddBind({ bind, label, errorTitle }): Promise<void> {
        const { medium, address } = this.props.msisdn;

        const task = new AddThreepid();
        this.setState({
            verifying: true,
            continueDisabled: true,
            addTask: task,
        });

        try {
            await MatrixClientPeg.get().deleteThreePid(medium, address);
            // XXX: Sydent will accept a number without country code if you add
            // a leading plus sign to a number in E.164 format (which the 3PID
            // address is), but this goes against the spec.
            // See https://github.com/matrix-org/matrix-doc/issues/2222
            if (bind) {
                await task.bindMsisdn(null, `+${address}`);
            } else {
                await task.addMsisdn(null, `+${address}`);
            }
            this.setState({
                continueDisabled: false,
                bound: bind,
            });
        } catch (err) {
            logger.error(`Unable to ${label} phone number ${address} ${err}`);
            this.setState({
                verifying: false,
                continueDisabled: false,
                addTask: null,
            });
            Modal.createDialog(ErrorDialog, {
                title: errorTitle,
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        }
    }

    private onRevokeClick = (e: React.MouseEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        this.changeBinding({
            bind: false,
            label: "revoke",
            errorTitle: _t("Unable to revoke sharing for phone number"),
        });
    };

    private onShareClick = (e: React.MouseEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        this.changeBinding({
            bind: true,
            label: "share",
            errorTitle: _t("Unable to share phone number"),
        });
    };

    private onVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            verificationCode: e.target.value,
        });
    };

    private onContinueClick = async (e: React.MouseEvent | React.FormEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({ continueDisabled: true });
        const token = this.state.verificationCode;
        try {
            await this.state.addTask.haveMsisdnToken(token);
            this.setState({
                addTask: null,
                continueDisabled: false,
                verifying: false,
                verifyError: null,
                verificationCode: "",
            });
        } catch (err) {
            this.setState({ continueDisabled: false });
            if (err.errcode !== 'M_THREEPID_AUTH_FAILED') {
                logger.error("Unable to verify phone number: " + err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Unable to verify phone number."),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            } else {
                this.setState({ verifyError: _t("Incorrect verification code") });
            }
        }
    };

    public render(): JSX.Element {
        const { address } = this.props.msisdn;
        const { verifying, bound } = this.state;

        let status;
        if (verifying) {
            status = <span className="mx_ExistingPhoneNumber_verification">
                <span>
                    { _t("Please enter verification code sent via text.") }
                    <br />
                    { this.state.verifyError }
                </span>
                <form onSubmit={this.onContinueClick} autoComplete="off" noValidate={true}>
                    <Field
                        type="text"
                        label={_t("Verification code")}
                        autoComplete="off"
                        disabled={this.state.continueDisabled}
                        value={this.state.verificationCode}
                        onChange={this.onVerificationCodeChange}
                    />
                </form>
            </span>;
        } else if (bound) {
            status = <AccessibleButton
                className="mx_ExistingPhoneNumber_confirmBtn"
                kind="danger_sm"
                onClick={this.onRevokeClick}
            >
                { _t("Revoke") }
            </AccessibleButton>;
        } else {
            status = <AccessibleButton
                className="mx_ExistingPhoneNumber_confirmBtn"
                kind="primary_sm"
                onClick={this.onShareClick}
            >
                { _t("Share") }
            </AccessibleButton>;
        }

        return (
            <div className="mx_ExistingPhoneNumber">
                <span className="mx_ExistingPhoneNumber_address">+{ address }</span>
                { status }
            </div>
        );
    }
}

interface IProps {
    msisdns: IThreepid[];
}

export default class PhoneNumbers extends React.Component<IProps> {
    public render(): JSX.Element {
        let content;
        if (this.props.msisdns.length > 0) {
            content = this.props.msisdns.map((e) => {
                return <PhoneNumber msisdn={e} key={e.address} />;
            });
        } else {
            content = <span className="mx_SettingsTab_subsectionText">
                { _t("Discovery options will appear once you have added a phone number above.") }
            </span>;
        }

        return (
            <div className="mx_PhoneNumbers">
                { content }
            </div>
        );
    }
}
