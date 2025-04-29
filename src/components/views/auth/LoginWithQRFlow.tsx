/*
Copyright 2024 New Vector Ltd.
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, type ReactNode } from "react";
import { ClientRendezvousFailureReason, MSC4108FailureReason } from "matrix-js-sdk/src/rendezvous";
import ChevronLeftIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-left";
import CheckCircleSolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/check-circle-solid";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import { Heading, MFAInput, Text } from "@vector-im/compound-web";
import classNames from "classnames";
import { QrCodeIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import QRCode from "../elements/QRCode";
import Spinner from "../elements/Spinner";
import { Click, Phase } from "./LoginWithQR-types";
import SdkConfig from "../../../SdkConfig";
import { type FailureReason, LoginWithQRFailureReason } from "./LoginWithQR";
import { ErrorMessage } from "../../structures/ErrorMessage";

interface Props {
    phase: Phase;
    code?: Uint8Array;
    onClick(type: Click, checkCodeEntered?: string): Promise<void>;
    failureReason?: FailureReason;
    userCode?: string;
    checkCode?: string;
}

/**
 * A component that implements the UI for sign in and E2EE set up with a QR code.
 *
 * This supports the unstable features of MSC4108
 */
export default class LoginWithQRFlow extends React.Component<Props> {
    private checkCodeInput = createRef<HTMLInputElement>();

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
                backButton = false;

                let Icon = ErrorIcon;
                let success: boolean | null = false;
                let title: string | undefined;
                let message: ReactNode | undefined;

                switch (this.props.failureReason) {
                    case MSC4108FailureReason.UnsupportedProtocol:
                        title = _t("auth|qr_code_login|error_unsupported_protocol_title");
                        message = _t("auth|qr_code_login|error_unsupported_protocol");
                        break;

                    case MSC4108FailureReason.UserCancelled:
                        title = _t("auth|qr_code_login|error_user_cancelled_title");
                        message = _t("auth|qr_code_login|error_user_cancelled");
                        break;

                    case MSC4108FailureReason.AuthorizationExpired:
                    case ClientRendezvousFailureReason.Expired:
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
                        Icon = CheckCircleSolidIcon;
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

                    case ClientRendezvousFailureReason.HomeserverLacksSupport:
                        success = null;
                        Icon = QrCodeIcon;
                        backButton = true;
                        title = _t("auth|qr_code_login|unsupported_heading");
                        message = _t("auth|qr_code_login|unsupported_explainer");
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
                main = (
                    <>
                        <div
                            className={classNames("mx_LoginWithQR_icon", {
                                "mx_LoginWithQR_icon--critical": success === false,
                                "mx_LoginWithQR_icon--success": success === true,
                            })}
                        >
                            <Icon width="32px" height="32px" />
                        </div>
                        <Heading as="h1" size="sm" weight="semibold">
                            {title}
                        </Heading>
                        {typeof message === "object" ? message : <p data-testid="cancellation-message">{message}</p>}
                    </>
                );
                break;
            }
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
                    const data = this.props.code;

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
                                        scanQRCode: <strong>{_t("auth|qr_code_login|scan_qr_code")}</strong>,
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
