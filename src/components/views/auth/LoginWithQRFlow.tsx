/*
Copyright 2022 - 2024 The Matrix.org Foundation C.I.C.

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

import React, { createRef, ReactNode } from "react";
import {
    ClientRendezvousFailureReason,
    LegacyRendezvousFailureReason,
    MSC4108FailureReason,
} from "matrix-js-sdk/src/rendezvous";
import { Icon as ChevronLeftIcon } from "@vector-im/compound-design-tokens/icons/chevron-left.svg";
import { Icon as CheckCircleSolidIcon } from "@vector-im/compound-design-tokens/icons/check-circle-solid.svg";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import { Heading, MFAInput, Text } from "@vector-im/compound-web";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import QRCode from "../elements/QRCode";
import Spinner from "../elements/Spinner";
import { Icon as InfoIcon } from "../../../../res/img/element-icons/i.svg";
import { Click, Phase } from "./LoginWithQR-types";
import SdkConfig from "../../../SdkConfig";
import { FailureReason, LoginWithQRFailureReason } from "./LoginWithQR";
import { XOR } from "../../../@types/common";
import { ErrorMessage } from "../../structures/ErrorMessage";

/**
 * @deprecated the MSC3906 implementation is deprecated in favour of MSC4108.
 */
interface MSC3906Props extends Pick<Props, "phase" | "onClick" | "failureReason"> {
    code?: string;
    confirmationDigits?: string;
}

interface Props {
    phase: Phase;
    code?: Uint8Array;
    onClick(type: Click, checkCodeEntered?: string): Promise<void>;
    failureReason?: FailureReason;
    userCode?: string;
    checkCode?: string;
}

// n.b MSC3886/MSC3903/MSC3906 that this is based on are now closed.
// However, we want to keep this implementation around for some time.
// TODO: define an end-of-life date for this implementation.

/**
 * A component that implements the UI for sign in and E2EE set up with a QR code.
 *
 * This supports the unstable features of MSC3906 and MSC4108
 */
export default class LoginWithQRFlow extends React.Component<XOR<Props, MSC3906Props>> {
    private checkCodeInput = createRef<HTMLInputElement>();

    public constructor(props: XOR<Props, MSC3906Props>) {
        super(props);
    }

    private handleClick = (type: Click): ((e: React.FormEvent) => Promise<void>) => {
        return async (e: React.FormEvent): Promise<void> => {
            e.preventDefault();
            await this.props.onClick(type, type === Click.Approve ? this.checkCodeInput.current?.value : undefined);
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
        let className = "";

        switch (this.props.phase) {
            case Phase.Error: {
                let success = false;
                let title: string | undefined;
                let message: ReactNode | undefined;

                switch (this.props.failureReason) {
                    case MSC4108FailureReason.UnsupportedProtocol:
                    case LegacyRendezvousFailureReason.UnsupportedProtocol:
                        title = _t("auth|qr_code_login|error_unsupported_protocol_title");
                        message = _t("auth|qr_code_login|error_unsupported_protocol");
                        break;

                    case MSC4108FailureReason.UserCancelled:
                    case LegacyRendezvousFailureReason.UserCancelled:
                        title = _t("auth|qr_code_login|error_user_cancelled_title");
                        message = _t("auth|qr_code_login|error_user_cancelled");
                        break;

                    case MSC4108FailureReason.AuthorizationExpired:
                    case ClientRendezvousFailureReason.Expired:
                    case LegacyRendezvousFailureReason.Expired:
                        title = _t("auth|qr_code_login|error_expired_title");
                        message = _t("auth|qr_code_login|error_expired");
                        break;

                    case ClientRendezvousFailureReason.InsecureChannelDetected:
                        title = _t("auth|qr_code_login|error_insecure_channel_detected_title");
                        message = (
                            <>
                                {_t("auth|qr_code_login|error_insecure_channel_detected")}

                                <Text as="h2" size="lg" weight="semibold" data-testid="cancellation-message">
                                    {_t("auth|qr_code_login|error_insecure_channel_detected_instructions")}
                                </Text>
                                <ol>
                                    <li>{_t("auth|qr_code_login|error_insecure_channel_detected_instructions_1")}</li>
                                    <li>{_t("auth|qr_code_login|error_insecure_channel_detected_instructions_2")}</li>
                                    <li>{_t("auth|qr_code_login|error_insecure_channel_detected_instructions_3")}</li>
                                </ol>
                            </>
                        );
                        break;

                    case ClientRendezvousFailureReason.OtherDeviceAlreadySignedIn:
                        success = true;
                        title = _t("auth|qr_code_login|error_other_device_already_signed_in_title");
                        message = _t("auth|qr_code_login|error_other_device_already_signed_in");
                        break;

                    case ClientRendezvousFailureReason.UserDeclined:
                        title = _t("auth|qr_code_login|error_user_declined_title");
                        message = _t("auth|qr_code_login|error_user_declined");
                        break;

                    case LoginWithQRFailureReason.RateLimited:
                        title = _t("error|something_went_wrong");
                        message = _t("auth|qr_code_login|error_rate_limited");
                        break;

                    case ClientRendezvousFailureReason.ETagMissing:
                        title = _t("error|something_went_wrong");
                        message = _t("auth|qr_code_login|error_etag_missing");
                        break;

                    case MSC4108FailureReason.DeviceAlreadyExists:
                    case MSC4108FailureReason.DeviceNotFound:
                    case MSC4108FailureReason.UnexpectedMessageReceived:
                    case ClientRendezvousFailureReason.OtherDeviceNotSignedIn:
                    case ClientRendezvousFailureReason.Unknown:
                    default:
                        title = _t("error|something_went_wrong");
                        message = _t("auth|qr_code_login|error_unexpected");
                        break;
                }
                className = "mx_LoginWithQR_error";
                backButton = false;
                main = (
                    <>
                        <div
                            className={classNames("mx_LoginWithQR_icon", {
                                "mx_LoginWithQR_icon--critical": !success,
                            })}
                        >
                            {success ? <CheckCircleSolidIcon width="32px" /> : <ErrorIcon width="32px" />}
                        </div>
                        <Heading as="h1" size="sm" weight="semibold">
                            {title}
                        </Heading>
                        {typeof message === "object" ? message : <p data-testid="cancellation-message">{message}</p>}
                    </>
                );
                break;
            }
            case Phase.LegacyConnected:
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
                            data-testid="approve-login-button"
                            kind="primary"
                            onClick={this.handleClick(Click.Approve)}
                        >
                            {_t("action|approve")}
                        </AccessibleButton>
                        <AccessibleButton
                            data-testid="decline-login-button"
                            kind="primary_outline"
                            onClick={this.handleClick(Click.Decline)}
                        >
                            {_t("action|cancel")}
                        </AccessibleButton>
                    </>
                );
                break;
            case Phase.OutOfBandConfirmation:
                backButton = false;
                main = (
                    <>
                        <Heading as="h1" size="sm" weight="semibold">
                            {_t("auth|qr_code_login|check_code_heading")}
                        </Heading>
                        <Text size="md">{_t("auth|qr_code_login|check_code_explainer")}</Text>
                        <label htmlFor="mx_LoginWithQR_checkCode">
                            {_t("auth|qr_code_login|check_code_input_label")}
                        </label>
                        <MFAInput
                            className="mx_LoginWithQR_checkCode_input mx_no_textinput"
                            ref={this.checkCodeInput}
                            length={2}
                            autoFocus
                            id="mx_LoginWithQR_checkCode"
                            data-invalid={
                                this.props.failureReason === LoginWithQRFailureReason.CheckCodeMismatch
                                    ? true
                                    : undefined
                            }
                        />
                        <ErrorMessage
                            message={
                                this.props.failureReason === LoginWithQRFailureReason.CheckCodeMismatch
                                    ? _t("auth|qr_code_login|check_code_mismatch")
                                    : null
                            }
                        />
                    </>
                );

                buttons = (
                    <>
                        <AccessibleButton
                            data-testid="approve-login-button"
                            kind="primary"
                            onClick={this.handleClick(Click.Approve)}
                        >
                            {_t("action|continue")}
                        </AccessibleButton>
                        <AccessibleButton
                            data-testid="decline-login-button"
                            kind="primary_outline"
                            onClick={this.handleClick(Click.Decline)}
                        >
                            {_t("action|cancel")}
                        </AccessibleButton>
                    </>
                );
                break;
            case Phase.ShowingQR:
                if (this.props.code) {
                    const data =
                        typeof this.props.code !== "string" ? this.props.code : Buffer.from(this.props.code ?? "");

                    main = (
                        <>
                            <Heading as="h1" size="sm" weight="semibold">
                                {_t("auth|qr_code_login|scan_code_instruction")}
                            </Heading>
                            <div className="mx_LoginWithQR_qrWrapper">
                                <QRCode data={[{ data, mode: "byte" }]} className="mx_QRCode" />
                            </div>
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
            case Phase.WaitingForDevice:
                main = (
                    <>
                        {this.simpleSpinner(_t("auth|qr_code_login|waiting_for_device"))}
                        {this.props.userCode ? (
                            <div>
                                <p>{_t("auth|qr_code_login|security_code")}</p>
                                <p>{_t("auth|qr_code_login|security_code_prompt")}</p>
                                <p>{this.props.userCode}</p>
                            </div>
                        ) : null}
                    </>
                );
                buttons = this.cancelButton();
                break;
            case Phase.Verifying:
                main = this.simpleSpinner(_t("auth|qr_code_login|completing_setup"));
                break;
        }

        return (
            <div data-testid="login-with-qr" className={classNames("mx_LoginWithQR", className)}>
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
                <div className="mx_LoginWithQR_main">{main}</div>
                <div className="mx_LoginWithQR_buttons">{buttons}</div>
            </div>
        );
    }
}
