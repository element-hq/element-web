/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import {
    type ShowQrCodeCallbacks,
    type ShowSasCallbacks,
    VerificationPhase as Phase,
    type VerificationRequest,
    VerificationRequestEvent,
    VerifierEvent,
} from "matrix-js-sdk/src/crypto-api";
import { type Device, type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { VerificationMethod } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import E2EIcon from "../rooms/E2EIcon";
import Spinner from "../elements/Spinner";
import AccessibleButton from "../elements/AccessibleButton";
import VerificationShowSas from "../verification/VerificationShowSas";
import { getDeviceCryptoInfo } from "../../../utils/crypto/deviceInfo";
import { E2EStatus } from "../../../utils/ShieldUtils";

interface IProps {
    layout: string;
    request: VerificationRequest;
    member: RoomMember | User;
    phase?: Phase;
    onClose: () => void;
    isRoomEncrypted: boolean;
    inDialog: boolean;
}

interface IState {
    /**
     * The data for the QR code to display.
     *
     * We attempt to calculate this once the verification request transitions into the "Ready" phase. If the other
     * side cannot scan QR codes, it will remain `undefined`.
     */
    qrCodeBytes: Uint8ClampedArray | undefined;

    sasEvent: ShowSasCallbacks | null;
    emojiButtonClicked?: boolean;
    reciprocateButtonClicked?: boolean;
    reciprocateQREvent: ShowQrCodeCallbacks | null;

    /**
     * Details of the other device involved in the transaction.
     *
     * `undefined` if there is not (yet) another device in the transaction, or if we do not know about it.
     */
    otherDeviceDetails?: Device;
}

export default class VerificationPanel extends React.PureComponent<IProps, IState> {
    private hasVerifier: boolean;

    /** have we yet tried to check the other device's info */
    private haveCheckedDevice = false;

    /** have we yet tried to get the QR code */
    private haveFetchedQRCode = false;

    public constructor(props: IProps) {
        super(props);
        this.state = { qrCodeBytes: undefined, sasEvent: null, reciprocateQREvent: null };
        this.hasVerifier = false;
    }

    private renderQRPhase(): JSX.Element {
        const { member, request } = this.props;
        const showSAS: boolean = request.otherPartySupportsMethod(VerificationMethod.Sas);
        const showQR: boolean = request.otherPartySupportsMethod(VerificationMethod.ScanQrCode);
        const brand = SdkConfig.get().brand;

        const noCommonMethodError: JSX.Element | null =
            !showSAS && !showQR ? <p>{_t("encryption|verification|no_support_qr_emoji", { brand })}</p> : null;

        if (this.props.layout === "dialog") {
            // HACK: This is a terrible idea.
            let qrBlockDialog: JSX.Element | undefined;
            let sasBlockDialog: JSX.Element | undefined;
            if (showQR) {
                qrBlockDialog = (
                    <div className="mx_VerificationPanel_QRPhase_startOption">
                        <p>{_t("encryption|verification|qr_prompt")}</p>
                        <VerificationQRCode qrCodeBytes={this.state.qrCodeBytes} />
                    </div>
                );
            }
            if (showSAS) {
                sasBlockDialog = (
                    <div className="mx_VerificationPanel_QRPhase_startOption">
                        <p>{_t("encryption|verification|sas_prompt")}</p>
                        <span className="mx_VerificationPanel_QRPhase_helpText">
                            {_t("encryption|verification|sas_description")}
                        </span>
                        <AccessibleButton
                            disabled={this.state.emojiButtonClicked}
                            onClick={this.startSAS}
                            kind="primary"
                        >
                            {_t("action|start")}
                        </AccessibleButton>
                    </div>
                );
            }
            const or =
                qrBlockDialog && sasBlockDialog ? (
                    <div className="mx_VerificationPanel_QRPhase_betweenText">
                        {_t("encryption|verification|qr_or_sas", {
                            emojiCompare: "",
                            qrCode: "",
                        })}
                    </div>
                ) : null;
            return (
                <div>
                    {_t("encryption|verification|qr_or_sas_header")}
                    <div className="mx_VerificationPanel_QRPhase_startOptions">
                        {qrBlockDialog}
                        {or}
                        {sasBlockDialog}
                        {noCommonMethodError}
                    </div>
                </div>
            );
        }

        let qrBlock: JSX.Element | undefined;
        if (showQR) {
            qrBlock = (
                <div className="mx_UserInfo_container">
                    <h3>{_t("encryption|verification|scan_qr")}</h3>
                    <p>
                        {_t("encryption|verification|scan_qr_explainer", {
                            displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
                        })}
                    </p>

                    <div className="mx_VerificationPanel_qrCode">
                        <VerificationQRCode qrCodeBytes={this.state.qrCodeBytes} />
                    </div>
                </div>
            );
        }

        let sasBlock: JSX.Element | undefined;
        if (showSAS) {
            const disabled = this.state.emojiButtonClicked;
            const sasLabel = showQR
                ? _t("encryption|verification|verify_emoji_prompt_qr")
                : _t("encryption|verification|verify_emoji_prompt");

            // Note: mx_VerificationPanel_verifyByEmojiButton is for the end-to-end tests
            sasBlock = (
                <div className="mx_UserInfo_container">
                    <h3>{_t("encryption|verification|verify_emoji")}</h3>
                    <p>{sasLabel}</p>
                    <AccessibleButton
                        disabled={disabled}
                        kind="primary"
                        className="mx_UserInfo_wideButton mx_VerificationPanel_verifyByEmojiButton"
                        onClick={this.startSAS}
                    >
                        {_t("encryption|verification|verify_emoji")}
                    </AccessibleButton>
                </div>
            );
        }

        const noCommonMethodBlock = noCommonMethodError ? (
            <div className="mx_UserInfo_container">{noCommonMethodError}</div>
        ) : null;

        // TODO: add way to open camera to scan a QR code
        return (
            <React.Fragment>
                {qrBlock}
                {sasBlock}
                {noCommonMethodBlock}
            </React.Fragment>
        );
    }

    private onReciprocateYesClick = (): void => {
        if (!this.state.reciprocateQREvent) return;
        this.setState({ reciprocateButtonClicked: true });
        this.state.reciprocateQREvent?.confirm();
    };

    private onReciprocateNoClick = (): void => {
        if (!this.state.reciprocateQREvent) return;
        this.setState({ reciprocateButtonClicked: true });
        this.state.reciprocateQREvent?.cancel();
    };

    /**
     * Get details of the other device involved in the verification, if we haven't before, and store in the state.
     */
    private async maybeGetOtherDevice(): Promise<void> {
        if (this.haveCheckedDevice) return;

        const client = MatrixClientPeg.safeGet();
        const deviceId = this.props.request?.otherDeviceId;
        const userId = client.getUserId();
        if (!deviceId || !userId) {
            return;
        }
        this.haveCheckedDevice = true;
        this.setState({ otherDeviceDetails: await getDeviceCryptoInfo(client, userId, deviceId) });
    }

    private renderQRReciprocatePhase(): JSX.Element {
        const { member, request } = this.props;
        const description = request.isSelfVerification
            ? _t("encryption|verification|qr_reciprocate_same_shield_device")
            : _t("encryption|verification|qr_reciprocate_same_shield_user", {
                  displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
              });
        let body: JSX.Element;
        if (this.state.reciprocateQREvent) {
            // Element Web doesn't support scanning yet, so assume here we're the client being scanned.
            body = (
                <React.Fragment>
                    <p>{description}</p>
                    <E2EIcon isUser={true} status={E2EStatus.Verified} size={128} hideTooltip={true} />
                    <div className="mx_VerificationPanel_reciprocateButtons">
                        <AccessibleButton
                            kind="danger"
                            disabled={this.state.reciprocateButtonClicked}
                            onClick={this.onReciprocateNoClick}
                        >
                            {_t("action|no")}
                        </AccessibleButton>
                        <AccessibleButton
                            kind="primary"
                            disabled={this.state.reciprocateButtonClicked}
                            onClick={this.onReciprocateYesClick}
                        >
                            {_t("action|yes")}
                        </AccessibleButton>
                    </div>
                </React.Fragment>
            );
        } else {
            body = (
                <p>
                    <Spinner />
                </p>
            );
        }
        return (
            <div className="mx_UserInfo_container mx_VerificationPanel_reciprocate_section">
                <h3>{_t("encryption|verification|scan_qr")}</h3>
                {body}
            </div>
        );
    }

    private renderVerifiedPhase(): JSX.Element {
        const { member, request } = this.props;

        let text: string | undefined;
        if (!request.isSelfVerification) {
            if (this.props.isRoomEncrypted) {
                text = _t("encryption|verification|prompt_encrypted");
            } else {
                text = _t("encryption|verification|prompt_unencrypted");
            }
        }

        let description: string;
        if (request.isSelfVerification) {
            const device = this.state.otherDeviceDetails;
            if (!device) {
                // This can happen if the device is logged out while we're still showing verification
                // UI for it.
                logger.warn("Verified device we don't know about: " + this.props.request.otherDeviceId);
                description = _t("encryption|verification|successful_own_device");
            } else {
                description = _t("encryption|verification|successful_device", {
                    deviceName: device.displayName,
                    deviceId: device.deviceId,
                });
            }
        } else {
            description = _t("encryption|verification|successful_user", {
                displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
            });
        }

        return (
            <div className="mx_UserInfo_container mx_VerificationPanel_verified_section">
                <p>{description}</p>
                <E2EIcon isUser={true} status={E2EStatus.Verified} size={128} hideTooltip={true} />
                {text ? <p>{text}</p> : null}
                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    {_t("action|got_it")}
                </AccessibleButton>
            </div>
        );
    }

    private renderCancelledPhase(): JSX.Element {
        const { member, request } = this.props;

        let startAgainInstruction: string;
        if (request.isSelfVerification) {
            startAgainInstruction = _t("encryption|verification|prompt_self");
        } else {
            startAgainInstruction = _t("encryption|verification|prompt_user");
        }

        let text: string;
        if (request.cancellationCode === "m.timeout") {
            text = _t("encryption|verification|timed_out") + ` ${startAgainInstruction}`;
        } else if (request.cancellingUserId === request.otherUserId) {
            if (request.isSelfVerification) {
                text = _t("encryption|verification|cancelled_self");
            } else {
                text = _t("encryption|verification|cancelled_user", {
                    displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
                });
            }
            text = `${text} ${startAgainInstruction}`;
        } else {
            text = _t("encryption|verification|cancelled") + ` ${startAgainInstruction}`;
        }

        return (
            <div className="mx_UserInfo_container">
                <h3>{_t("common|verification_cancelled")}</h3>
                <p>{text}</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    {_t("action|got_it")}
                </AccessibleButton>
            </div>
        );
    }

    public render(): React.ReactNode {
        const { member, phase, request } = this.props;

        const displayName = (member as User).displayName || (member as RoomMember).name || member.userId;

        switch (phase) {
            case Phase.Ready:
                return this.renderQRPhase();
            case Phase.Started:
                switch (request.chosenMethod) {
                    case VerificationMethod.Reciprocate:
                        return this.renderQRReciprocatePhase();
                    case VerificationMethod.Sas: {
                        const emojis = this.state.sasEvent ? (
                            <VerificationShowSas
                                displayName={displayName}
                                otherDeviceDetails={this.state.otherDeviceDetails}
                                sas={this.state.sasEvent.sas}
                                onCancel={this.onSasMismatchesClick}
                                onDone={this.onSasMatchesClick}
                                inDialog={this.props.inDialog}
                                isSelf={request.isSelfVerification}
                            />
                        ) : (
                            <Spinner />
                        );
                        return <div className="mx_UserInfo_container">{emojis}</div>;
                    }
                    default:
                        return null;
                }
            case Phase.Done:
                return this.renderVerifiedPhase();
            case Phase.Cancelled:
                return this.renderCancelledPhase();
        }
        logger.error("VerificationPanel unhandled phase:", phase);
        return null;
    }

    private startSAS = async (): Promise<void> => {
        this.setState({ emojiButtonClicked: true });
        await this.props.request.startVerification(VerificationMethod.Sas);
    };

    private onSasMatchesClick = (): void => {
        this.state.sasEvent?.confirm();
    };

    private onSasMismatchesClick = (): void => {
        this.state.sasEvent?.mismatch();
    };

    private updateVerifierState = (): void => {
        // this method is only called once we know there is a verifier.
        const verifier = this.props.request.verifier!;
        const sasEvent = verifier.getShowSasCallbacks();
        const reciprocateQREvent = verifier.getReciprocateQrCodeCallbacks();
        verifier.off(VerifierEvent.ShowSas, this.updateVerifierState);
        verifier.off(VerifierEvent.ShowReciprocateQr, this.updateVerifierState);
        this.setState({ sasEvent, reciprocateQREvent });
    };

    private onRequestChange = async (): Promise<void> => {
        const { request } = this.props;

        // if we have a device ID and did not have one before, fetch the device's details
        this.maybeGetOtherDevice();

        // if we have had a reply from the other side (ie, the phase is "ready") and we have not
        // yet done so, fetch the QR code
        if (request.phase === Phase.Ready && !this.haveFetchedQRCode) {
            this.haveFetchedQRCode = true;
            request.generateQRCode().then(
                (buf) => {
                    this.setState({ qrCodeBytes: buf });
                },
                (error) => {
                    console.error("Error generating QR code:", error);
                },
            );
        }

        const hadVerifier = this.hasVerifier;
        this.hasVerifier = !!request.verifier;
        if (!hadVerifier && this.hasVerifier) {
            request.verifier?.on(VerifierEvent.ShowSas, this.updateVerifierState);
            request.verifier?.on(VerifierEvent.ShowReciprocateQr, this.updateVerifierState);
            try {
                // on the requester side, this is also awaited in startSAS,
                // but that's ok as verify should return the same promise.
                await request.verifier?.verify();
            } catch (err) {
                logger.error("error verify", err);
            }
        }
    };

    public componentDidMount(): void {
        const { request } = this.props;
        request.on(VerificationRequestEvent.Change, this.onRequestChange);
        if (request.verifier) {
            const sasEvent = request.verifier.getShowSasCallbacks();
            const reciprocateQREvent = request.verifier.getReciprocateQrCodeCallbacks();
            this.setState({ sasEvent, reciprocateQREvent });
        }
        this.onRequestChange();
    }

    public componentWillUnmount(): void {
        const { request } = this.props;
        if (request.verifier) {
            request.verifier.off(VerifierEvent.ShowSas, this.updateVerifierState);
            request.verifier.off(VerifierEvent.ShowReciprocateQr, this.updateVerifierState);
        }
        request.off(VerificationRequestEvent.Change, this.onRequestChange);
    }
}
