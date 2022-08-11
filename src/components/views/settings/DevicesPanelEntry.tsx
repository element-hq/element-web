/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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
import { IMyDevice } from 'matrix-js-sdk/src/client';
import { logger } from "matrix-js-sdk/src/logger";
import classNames from 'classnames';

import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import Modal from "../../../Modal";
import SetupEncryptionDialog from '../dialogs/security/SetupEncryptionDialog';
import VerificationRequestDialog from '../../views/dialogs/VerificationRequestDialog';
import LogoutDialog from '../dialogs/LogoutDialog';
import DeviceTile from './devices/DeviceTile';
import SelectableDeviceTile from './devices/SelectableDeviceTile';

interface IProps {
    device: IMyDevice;
    isOwnDevice: boolean;
    verified: boolean | null;
    canBeVerified: boolean;
    onDeviceChange: () => void;
    onDeviceToggled: (device: IMyDevice) => void;
    selected: boolean;
}

interface IState {
    renaming: boolean;
    displayName: string;
}

export default class DevicesPanelEntry extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            renaming: false,
            displayName: props.device.display_name,
        };
    }

    private onDeviceToggled = (): void => {
        this.props.onDeviceToggled(this.props.device);
    };

    private onRename = (): void => {
        this.setState({ renaming: true });
    };

    private onChangeDisplayName = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            displayName: ev.target.value,
        });
    };

    private onRenameSubmit = async () => {
        this.setState({ renaming: false });
        await MatrixClientPeg.get().setDeviceDetails(this.props.device.device_id, {
            display_name: this.state.displayName,
        }).catch((e) => {
            logger.error("Error setting session display name", e);
            throw new Error(_t("Failed to set display name"));
        });
        this.props.onDeviceChange();
    };

    private onRenameCancel = (): void => {
        this.setState({ renaming: false });
    };

    private onOwnDeviceSignOut = (): void => {
        Modal.createDialog(LogoutDialog,
            /* props= */{}, /* className= */null,
            /* isPriority= */false, /* isStatic= */true);
    };

    private verify = async () => {
        if (this.props.isOwnDevice) {
            Modal.createDialog(SetupEncryptionDialog, {
                onFinished: this.props.onDeviceChange,
            });
        } else {
            const cli = MatrixClientPeg.get();
            const userId = cli.getUserId();
            const verificationRequestPromise = cli.requestVerification(
                userId,
                [this.props.device.device_id],
            );
            Modal.createDialog(VerificationRequestDialog, {
                verificationRequestPromise,
                member: cli.getUser(userId),
                onFinished: async () => {
                    const request = await verificationRequestPromise;
                    request.cancel();
                    this.props.onDeviceChange();
                },
            });
        }
    };

    public render(): JSX.Element {
        let iconClass = '';
        let verifyButton: JSX.Element;
        if (this.props.verified !== null) {
            iconClass = this.props.verified ? "mx_E2EIcon_verified" : "mx_E2EIcon_warning";
            if (!this.props.verified && this.props.canBeVerified) {
                verifyButton = <AccessibleButton kind="primary" onClick={this.verify}>
                    { _t("Verify") }
                </AccessibleButton>;
            }
        }

        let signOutButton: JSX.Element;
        if (this.props.isOwnDevice) {
            signOutButton = <AccessibleButton kind="danger_outline" onClick={this.onOwnDeviceSignOut}>
                { _t("Sign Out") }
            </AccessibleButton>;
        }

        const buttons = this.state.renaming ?
            <form className="mx_DevicesPanel_renameForm" onSubmit={this.onRenameSubmit}>
                <Field
                    label={_t("Display Name")}
                    type="text"
                    value={this.state.displayName}
                    autoComplete="off"
                    onChange={this.onChangeDisplayName}
                    autoFocus
                />
                <AccessibleButton onClick={this.onRenameSubmit} kind="confirm_sm" />
                <AccessibleButton onClick={this.onRenameCancel} kind="cancel_sm" />
            </form> :
            <React.Fragment>
                { signOutButton }
                { verifyButton }
                <AccessibleButton kind="primary_outline" onClick={this.onRename}>
                    { _t("Rename") }
                </AccessibleButton>
            </React.Fragment>;

        const deviceWithVerification = {
            ...this.props.device,
            isVerified: this.props.verified,
        };

        if (this.props.isOwnDevice) {
            return <div className={classNames("mx_DevicesPanel_device", "mx_DevicesPanel_myDevice")}>
                <div className="mx_DevicesPanel_deviceTrust">
                    <span className={"mx_DevicesPanel_icon mx_E2EIcon " + iconClass} />
                </div>
                <DeviceTile device={deviceWithVerification}>
                    { buttons }
                </DeviceTile>
            </div>;
        }

        return (
            <div className="mx_DevicesPanel_device">
                <SelectableDeviceTile device={deviceWithVerification} onClick={this.onDeviceToggled} isSelected={this.props.selected}>
                    { buttons }
                </SelectableDeviceTile>
            </div>
        );
    }
}
