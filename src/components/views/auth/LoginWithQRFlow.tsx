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
import { Icon as ChevronLeftIcon } from "@vector-im/compound-design-tokens/icons/chevron-left.svg";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import QRCode from "../elements/QRCode";
import Spinner from "../elements/Spinner";
import { Icon as InfoIcon } from "../../../../res/img/element-icons/i.svg";
import { Click, FailureReason, LoginWithQRFailureReason, Phase } from "./LoginWithQR";
import SdkConfig from "../../../SdkConfig";

interface IProps {
    phase: Phase;
    code?: string;
    onClick(type: Click): Promise<void>;
    failureReason?: FailureReason;
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
            {_t("action|cancel")}
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
        let main: JSX.Element | undefined;
        let buttons: JSX.Element | undefined;
        let backButton = true;
        let cancellationMessage: string | undefined;
        let centreTitle = false;

        switch (this.props.phase) {
            case Phase.Error:
                switch (this.props.failureReason) {
                    case RendezvousFailureReason.Expired:
                        cancellationMessage = _t("auth|qr_code_login|error_linking_incomplete");
                        break;
                    case RendezvousFailureReason.InvalidCode:
                        cancellationMessage = _t("auth|qr_code_login|error_invalid_scanned_code");
                        break;
                    case RendezvousFailureReason.UnsupportedAlgorithm:
                        cancellationMessage = _t("auth|qr_code_login|error_device_unsupported");
                        break;
                    case RendezvousFailureReason.UserDeclined:
                        cancellationMessage = _t("auth|qr_code_login|error_request_declined");
                        break;
                    case RendezvousFailureReason.OtherDeviceAlreadySignedIn:
                        cancellationMessage = _t("auth|qr_code_login|error_device_already_signed_in");
                        break;
                    case RendezvousFailureReason.OtherDeviceNotSignedIn:
                        cancellationMessage = _t("auth|qr_code_login|error_device_not_signed_in");
                        break;
                    case RendezvousFailureReason.UserCancelled:
                        cancellationMessage = _t("auth|qr_code_login|error_request_cancelled");
                        break;
                    case LoginWithQRFailureReason.RateLimited:
                        cancellationMessage = _t("auth|qr_code_login|error_rate_limited");
                        break;
                    case RendezvousFailureReason.Unknown:
                        cancellationMessage = _t("auth|qr_code_login|error_unexpected");
                        break;
                    case RendezvousFailureReason.HomeserverLacksSupport:
                        cancellationMessage = _t("auth|qr_code_login|error_homeserver_lacks_support");
                        break;
                    default:
                        cancellationMessage = _t("auth|qr_code_login|error_request_cancelled");
                        break;
                }
                centreTitle = true;
                backButton = false;
                main = <p data-testid="cancellation-message">{cancellationMessage}</p>;
                buttons = (
                    <>
                        <AccessibleButton
                            data-testid="try-again-button"
                            kind="primary"
                            onClick={this.handleClick(Click.TryAgain)}
                        >
                            {_t("action|try_again")}
                        </AccessibleButton>
                        {this.cancelButton()}
                    </>
                );
                break;
            case Phase.Connected:
                backButton = false;
                main = (
                    <>
                        <p>{_t("auth|qr_code_login|confirm_code_match")}</p>
                        <div className="mx_LoginWithQR_confirmationDigits">{this.props.confirmationDigits}</div>
                        <div className="mx_LoginWithQR_confirmationAlert">
                            <div>
                                <InfoIcon />
                            </div>
                            <div>{_t("auth|qr_code_login|approve_access_warning")}</div>
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
                            {_t("action|cancel")}
                        </AccessibleButton>
                        <AccessibleButton
                            data-testid="approve-login-button"
                            kind="primary"
                            onClick={this.handleClick(Click.Approve)}
                        >
                            {_t("action|approve")}
                        </AccessibleButton>
                    </>
                );
                break;
            case Phase.ShowingQR:
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
                            <h1>{_t("auth|qr_code_login|scan_code_instruction")}</h1>
                            {code}
                            <ol>
                                <li>
                                    {_t("auth|qr_code_login|open_element_other_device", {
                                        brand: SdkConfig.get().brand,
                                    })}
                                </li>
                                <li>
                                    {_t("auth|qr_code_login|select_qr_code", {
                                        scanQRCode: <b>{_t("auth|qr_code_login|scan_qr_code")}</b>,
                                    })}
                                </li>
                                <li>{_t("auth|qr_code_login|point_the_camera")}</li>
                                <li>{_t("auth|qr_code_login|follow_remaining_instructions")}</li>
                            </ol>
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
                main = this.simpleSpinner(_t("auth|qr_code_login|connecting"));
                buttons = this.cancelButton();
                break;
            case Phase.WaitingForDevice:
                main = this.simpleSpinner(_t("auth|qr_code_login|waiting_for_device"));
                buttons = this.cancelButton();
                break;
            case Phase.Verifying:
                centreTitle = true;
                main = this.simpleSpinner(_t("auth|qr_code_login|completing_setup"));
                break;
        }

        return (
            <div data-testid="login-with-qr" className="mx_LoginWithQR">
                <div className={centreTitle ? "mx_LoginWithQR_centreTitle" : ""}>
                    {backButton ? (
                        <div className="mx_LoginWithQR_heading">
                            <AccessibleButton
                                data-testid="back-button"
                                className="mx_LoginWithQR_BackButton"
                                onClick={this.handleClick(Click.Back)}
                                title="Back"
                            >
                                <ChevronLeftIcon />
                            </AccessibleButton>
                            <div className="mx_LoginWithQR_breadcrumbs">
                                {_t("settings|sessions|title")} / {_t("settings|sessions|sign_in_with_qr")}
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="mx_LoginWithQR_main">{main}</div>
                <div className="mx_LoginWithQR_buttons">{buttons}</div>
            </div>
        );
    }
}
