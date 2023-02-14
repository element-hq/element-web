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

import React from "react";
import { RendezvousFailureReason } from "matrix-js-sdk/src/rendezvous";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import QRCode from "../elements/QRCode";
import Spinner from "../elements/Spinner";
import { Icon as BackButtonIcon } from "../../../../res/img/element-icons/back.svg";
import { Icon as DevicesIcon } from "../../../../res/img/element-icons/devices.svg";
import { Icon as WarningBadge } from "../../../../res/img/element-icons/warning-badge.svg";
import { Icon as InfoIcon } from "../../../../res/img/element-icons/i.svg";
import { Click, Phase } from "./LoginWithQR";

interface IProps {
    phase: Phase;
    code?: string;
    onClick(type: Click): Promise<void>;
    failureReason?: RendezvousFailureReason;
    confirmationDigits?: string;
}

/**
 * A component that implements the UI for sign in and E2EE set up with a QR code.
 *
 * This uses the unstable feature of MSC3906: https://github.com/matrix-org/matrix-spec-proposals/pull/3906
 */
export default class LoginWithQRFlow extends React.Component<IProps> {
    public constructor(props: IProps) {
        super(props);
    }

    private handleClick = (type: Click): ((e: React.FormEvent) => Promise<void>) => {
        return async (e: React.FormEvent): Promise<void> => {
            e.preventDefault();
            await this.props.onClick(type);
        };
    };

    private cancelButton = (): JSX.Element => (
        <AccessibleButton data-testid="cancel-button" kind="primary_outline" onClick={this.handleClick(Click.Cancel)}>
            {_t("Cancel")}
        </AccessibleButton>
    );

    private simpleSpinner = (description?: string): JSX.Element => {
        return (
            <div className="mx_LoginWithQR_spinner">
                <div>
                    <Spinner />
                    {description && <p>{description}</p>}
                </div>
            </div>
        );
    };

    public render(): React.ReactNode {
        let title = "";
        let titleIcon: JSX.Element | undefined;
        let main: JSX.Element | undefined;
        let buttons: JSX.Element | undefined;
        let backButton = true;
        let cancellationMessage: string | undefined;
        let centreTitle = false;

        switch (this.props.phase) {
            case Phase.Error:
                switch (this.props.failureReason) {
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
                main = <p data-testid="cancellation-message">{cancellationMessage}</p>;
                buttons = (
                    <>
                        <AccessibleButton
                            data-testid="try-again-button"
                            kind="primary"
                            onClick={this.handleClick(Click.TryAgain)}
                        >
                            {_t("Try again")}
                        </AccessibleButton>
                        {this.cancelButton()}
                    </>
                );
                break;
            case Phase.Connected:
                title = _t("Devices connected");
                titleIcon = <DevicesIcon className="normal" />;
                backButton = false;
                main = (
                    <>
                        <p>{_t("Check that the code below matches with your other device:")}</p>
                        <div className="mx_LoginWithQR_confirmationDigits">{this.props.confirmationDigits}</div>
                        <div className="mx_LoginWithQR_confirmationAlert">
                            <div>
                                <InfoIcon />
                            </div>
                            <div>
                                {_t("By approving access for this device, it will have full access to your account.")}
                            </div>
                        </div>
                    </>
                );

                buttons = (
                    <>
                        <AccessibleButton
                            data-testid="decline-login-button"
                            kind="primary_outline"
                            onClick={this.handleClick(Click.Decline)}
                        >
                            {_t("Cancel")}
                        </AccessibleButton>
                        <AccessibleButton
                            data-testid="approve-login-button"
                            kind="primary"
                            onClick={this.handleClick(Click.Approve)}
                        >
                            {_t("Approve")}
                        </AccessibleButton>
                    </>
                );
                break;
            case Phase.ShowingQR:
                title = _t("Sign in with QR code");
                if (this.props.code) {
                    const code = (
                        <div className="mx_LoginWithQR_qrWrapper">
                            <QRCode
                                data={[{ data: Buffer.from(this.props.code ?? ""), mode: "byte" }]}
                                className="mx_QRCode"
                            />
                        </div>
                    );
                    main = (
                        <>
                            <p>{_t("Scan the QR code below with your device that's signed out.")}</p>
                            <ol>
                                <li>{_t("Start at the sign in screen")}</li>
                                <li>
                                    {_t("Select '%(scanQRCode)s'", {
                                        scanQRCode: _t("Scan QR code"),
                                    })}
                                </li>
                                <li>{_t("Review and approve the sign in")}</li>
                            </ol>
                            {code}
                        </>
                    );
                } else {
                    main = this.simpleSpinner();
                    buttons = this.cancelButton();
                }
                break;
            case Phase.Loading:
                main = this.simpleSpinner();
                break;
            case Phase.Connecting:
                main = this.simpleSpinner(_t("Connecting…"));
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
                    {backButton ? (
                        <AccessibleButton
                            data-testid="back-button"
                            className="mx_LoginWithQR_BackButton"
                            onClick={this.handleClick(Click.Back)}
                            title="Back"
                        >
                            <BackButtonIcon />
                        </AccessibleButton>
                    ) : null}
                    <h1>
                        {titleIcon}
                        {title}
                    </h1>
                </div>
                <div className="mx_LoginWithQR_main">{main}</div>
                <div className="mx_LoginWithQR_buttons">{buttons}</div>
            </div>
        );
    }
}
