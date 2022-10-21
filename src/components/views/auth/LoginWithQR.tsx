/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { MSC3906Rendezvous, MSC3906RendezvousPayload, RendezvousFailureReason } from 'matrix-js-sdk/src/rendezvous';
import { MSC3886SimpleHttpRendezvousTransport } from 'matrix-js-sdk/src/rendezvous/transports';
import { MSC3903ECDHPayload, MSC3903ECDHv1RendezvousChannel } from 'matrix-js-sdk/src/rendezvous/channels';
import { logger } from 'matrix-js-sdk/src/logger';
import { MatrixClient } from 'matrix-js-sdk/src/client';

import { _t } from "../../../languageHandler";
import AccessibleButton from '../elements/AccessibleButton';
import QRCode from '../elements/QRCode';
import Spinner from '../elements/Spinner';
import { Icon as BackButtonIcon } from "../../../../res/img/element-icons/back.svg";
import { Icon as DevicesIcon } from "../../../../res/img/element-icons/devices.svg";
import { Icon as WarningBadge } from "../../../../res/img/element-icons/warning-badge.svg";
import { Icon as InfoIcon } from "../../../../res/img/element-icons/i.svg";
import { wrapRequestWithDialog } from '../../../utils/UserInteractiveAuth';

/**
 * The intention of this enum is to have a mode that scans a QR code instead of generating one.
 */
export enum Mode {
    /**
     * A QR code with be generated and shown
     */
    Show = "show",
}

enum Phase {
    Loading,
    ShowingQR,
    Connecting,
    Connected,
    WaitingForDevice,
    Verifying,
    Error,
}

interface IProps {
    client: MatrixClient;
    mode: Mode;
    onFinished(...args: any): void;
}

interface IState {
    phase: Phase;
    rendezvous?: MSC3906Rendezvous;
    confirmationDigits?: string;
    failureReason?: RendezvousFailureReason;
    mediaPermissionError?: boolean;
}

/**
 * A component that allows sign in and E2EE set up with a QR code.
 *
 * It implements both `login.start` and `login-reciprocate` capabilities as well as both scanning and showing QR codes.
 *
 * This uses the unstable feature of MSC3906: https://github.com/matrix-org/matrix-spec-proposals/pull/3906
 */
export default class LoginWithQR extends React.Component<IProps, IState> {
    public constructor(props) {
        super(props);

        this.state = {
            phase: Phase.Loading,
        };
    }

    public componentDidMount(): void {
        this.updateMode(this.props.mode).then(() => {});
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.mode !== this.props.mode) {
            this.updateMode(this.props.mode).then(() => {});
        }
    }

    private async updateMode(mode: Mode) {
        this.setState({ phase: Phase.Loading });
        if (this.state.rendezvous) {
            this.state.rendezvous.onFailure = undefined;
            await this.state.rendezvous.cancel(RendezvousFailureReason.UserCancelled);
            this.setState({ rendezvous: undefined });
        }
        if (mode === Mode.Show) {
            await this.generateCode();
        }
    }

    public componentWillUnmount(): void {
        if (this.state.rendezvous) {
            // eslint-disable-next-line react/no-direct-mutation-state
            this.state.rendezvous.onFailure = undefined;
            // calling cancel will call close() as well to clean up the resources
            this.state.rendezvous.cancel(RendezvousFailureReason.UserCancelled).then(() => {});
        }
    }

    private approveLogin = async (): Promise<void> => {
        if (!this.state.rendezvous) {
            throw new Error('Rendezvous not found');
        }
        this.setState({ phase: Phase.Loading });

        try {
            logger.info("Requesting login token");

            const { login_token: loginToken } = await wrapRequestWithDialog(this.props.client.requestLoginToken, {
                matrixClient: this.props.client,
                title: _t("Sign in new device"),
            })();

            this.setState({ phase: Phase.WaitingForDevice });

            const newDeviceId = await this.state.rendezvous.approveLoginOnExistingDevice(loginToken);
            if (!newDeviceId) {
                // user denied
                return;
            }
            if (!this.props.client.crypto) {
                // no E2EE to set up
                this.props.onFinished(true);
                return;
            }
            await this.state.rendezvous.verifyNewDeviceOnExistingDevice();
            this.props.onFinished(true);
        } catch (e) {
            logger.error('Error whilst approving sign in', e);
            this.setState({ phase: Phase.Error, failureReason: RendezvousFailureReason.Unknown });
        }
    };

    private generateCode = async () => {
        let rendezvous: MSC3906Rendezvous;
        try {
            const transport = new MSC3886SimpleHttpRendezvousTransport<MSC3903ECDHPayload>({
                onFailure: this.onFailure,
                client: this.props.client,
            });

            const channel = new MSC3903ECDHv1RendezvousChannel<MSC3906RendezvousPayload>(
                transport, undefined, this.onFailure,
            );

            rendezvous = new MSC3906Rendezvous(channel, this.props.client, this.onFailure);

            await rendezvous.generateCode();
            this.setState({
                phase: Phase.ShowingQR,
                rendezvous,
                failureReason: undefined,
            });
        } catch (e) {
            logger.error('Error whilst generating QR code', e);
            this.setState({ phase: Phase.Error, failureReason: RendezvousFailureReason.HomeserverLacksSupport });
            return;
        }

        try {
            const confirmationDigits = await rendezvous.startAfterShowingCode();
            this.setState({ phase: Phase.Connected, confirmationDigits });
        } catch (e) {
            logger.error('Error whilst doing QR login', e);
            // only set to error phase if it hasn't already been set by onFailure or similar
            if (this.state.phase !== Phase.Error) {
                this.setState({ phase: Phase.Error, failureReason: RendezvousFailureReason.Unknown });
            }
        }
    };

    private onFailure = (reason: RendezvousFailureReason) => {
        logger.info(`Rendezvous failed: ${reason}`);
        this.setState({ phase: Phase.Error, failureReason: reason });
    };

    public reset() {
        this.setState({
            rendezvous: undefined,
            confirmationDigits: undefined,
            failureReason: undefined,
        });
    }

    private cancelClicked = async (e: React.FormEvent) => {
        e.preventDefault();
        await this.state.rendezvous?.cancel(RendezvousFailureReason.UserCancelled);
        this.reset();
        this.props.onFinished(false);
    };

    private declineClicked = async (e: React.FormEvent) => {
        e.preventDefault();
        await this.state.rendezvous?.declineLoginOnExistingDevice();
        this.reset();
        this.props.onFinished(false);
    };

    private tryAgainClicked = async (e: React.FormEvent) => {
        e.preventDefault();
        this.reset();
        await this.updateMode(this.props.mode);
    };

    private onBackClick = async () => {
        await this.state.rendezvous?.cancel(RendezvousFailureReason.UserCancelled);

        this.props.onFinished(false);
    };

    private cancelButton = () => <AccessibleButton
        kind="primary_outline"
        onClick={this.cancelClicked}
    >
        { _t("Cancel") }
    </AccessibleButton>;

    private simpleSpinner = (description?: string): JSX.Element => {
        return <div className="mx_LoginWithQR_spinner">
            <div>
                <Spinner />
                { description && <p>{ description }</p> }
            </div>
        </div>;
    };

    public render() {
        let title: string;
        let titleIcon: JSX.Element | undefined;
        let main: JSX.Element | undefined;
        let buttons: JSX.Element | undefined;
        let backButton = true;
        let cancellationMessage: string | undefined;
        let centreTitle = false;

        switch (this.state.phase) {
            case Phase.Error:
                switch (this.state.failureReason) {
                    case RendezvousFailureReason.Expired:
                        cancellationMessage = _t("The linking wasn't completed in the required time.");
                        break;
                    case RendezvousFailureReason.InvalidCode:
                        cancellationMessage = _t("The scanned code is invalid.");
                        break;
                    case RendezvousFailureReason.UnsupportedAlgorithm:
                        cancellationMessage = _t("Linking with this device is not supported.");
                        break;
                    case RendezvousFailureReason.UserDeclined:
                        cancellationMessage = _t("The request was declined on the other device.");
                        break;
                    case RendezvousFailureReason.OtherDeviceAlreadySignedIn:
                        cancellationMessage = _t("The other device is already signed in.");
                        break;
                    case RendezvousFailureReason.OtherDeviceNotSignedIn:
                        cancellationMessage = _t("The other device isn't signed in.");
                        break;
                    case RendezvousFailureReason.UserCancelled:
                        cancellationMessage = _t("The request was cancelled.");
                        break;
                    case RendezvousFailureReason.Unknown:
                        cancellationMessage = _t("An unexpected error occurred.");
                        break;
                    case RendezvousFailureReason.HomeserverLacksSupport:
                        cancellationMessage = _t("The homeserver doesn't support signing in another device.");
                        break;
                    default:
                        cancellationMessage = _t("The request was cancelled.");
                        break;
                }
                title = _t("Connection failed");
                centreTitle = true;
                titleIcon = <WarningBadge className="error" />;
                backButton = false;
                main = <p data-testid="cancellation-message">{ cancellationMessage }</p>;
                buttons = <>
                    <AccessibleButton
                        kind="primary"
                        onClick={this.tryAgainClicked}
                    >
                        { _t("Try again") }
                    </AccessibleButton>
                    { this.cancelButton() }
                </>;
                break;
            case Phase.Connected:
                title = _t("Devices connected");
                titleIcon = <DevicesIcon className="normal" />;
                backButton = false;
                main = <>
                    <p>{ _t("Check that the code below matches with your other device:") }</p>
                    <div className="mx_LoginWithQR_confirmationDigits">
                        { this.state.confirmationDigits }
                    </div>
                    <div className="mx_LoginWithQR_confirmationAlert">
                        <div>
                            <InfoIcon />
                        </div>
                        <div>{ _t("By approving access for this device, it will have full access to your account.") }</div>
                    </div>
                </>;

                buttons = <>
                    <AccessibleButton
                        data-testid="decline-login-button"
                        kind="primary_outline"
                        onClick={this.declineClicked}
                    >
                        { _t("Cancel") }
                    </AccessibleButton>
                    <AccessibleButton
                        data-testid="approve-login-button"
                        kind="primary"
                        onClick={this.approveLogin}
                    >
                        { _t("Approve") }
                    </AccessibleButton>
                </>;
                break;
            case Phase.ShowingQR:
                title =_t("Sign in with QR code");
                if (this.state.rendezvous) {
                    const code = <div className="mx_LoginWithQR_qrWrapper">
                        <QRCode data={[{ data: Buffer.from(this.state.rendezvous.code), mode: 'byte' }]} className="mx_QRCode" />
                    </div>;
                    main = <>
                        <p>{ _t("Scan the QR code below with your device that's signed out.") }</p>
                        <ol>
                            <li>{ _t("Start at the sign in screen") }</li>
                            <li>{ _t("Select 'Scan QR code'") }</li>
                            <li>{ _t("Review and approve the sign in") }</li>
                        </ol>
                        { code }
                    </>;
                } else {
                    main = this.simpleSpinner();
                    buttons = this.cancelButton();
                }
                break;
            case Phase.Loading:
                main = this.simpleSpinner();
                break;
            case Phase.Connecting:
                main = this.simpleSpinner(_t("Connecting..."));
                buttons = this.cancelButton();
                break;
            case Phase.WaitingForDevice:
                main = this.simpleSpinner(_t("Waiting for device to sign in"));
                buttons = this.cancelButton();
                break;
            case Phase.Verifying:
                title = _t("Success");
                centreTitle = true;
                main = this.simpleSpinner(_t("Completing set up of your new device"));
                break;
        }

        return (
            <div data-testid="login-with-qr" className="mx_LoginWithQR">
                <div className={centreTitle ? "mx_LoginWithQR_centreTitle" : ""}>
                    { backButton ?
                        <AccessibleButton
                            data-testid="back-button"
                            className="mx_LoginWithQR_BackButton"
                            onClick={this.onBackClick}
                            title="Back"
                        >
                            <BackButtonIcon />
                        </AccessibleButton>
                        : null }
                    <h1>{ titleIcon }{ title }</h1>
                </div>
                <div className="mx_LoginWithQR_main">
                    { main }
                </div>
                <div className="mx_LoginWithQR_buttons">
                    { buttons }
                </div>
            </div>
        );
    }
}
