/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import { verificationMethods } from "matrix-js-sdk/src/crypto";
import { SCAN_QR_CODE_METHOD } from "matrix-js-sdk/src/crypto/verification/QRCode";
import {
    Phase,
    VerificationRequest,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { User } from "matrix-js-sdk/src/models/user";
import { logger } from "matrix-js-sdk/src/logger";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { ShowQrCodeCallbacks, ShowSasCallbacks, VerifierEvent } from "matrix-js-sdk/src/crypto-api/verification";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import VerificationQRCode from "../elements/crypto/VerificationQRCode";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import E2EIcon, { E2EState } from "../rooms/E2EIcon";
import Spinner from "../elements/Spinner";
import AccessibleButton from "../elements/AccessibleButton";
import VerificationShowSas from "../verification/VerificationShowSas";

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
    sasEvent: ShowSasCallbacks | null;
    emojiButtonClicked?: boolean;
    reciprocateButtonClicked?: boolean;
    reciprocateQREvent: ShowQrCodeCallbacks | null;
}

export default class VerificationPanel extends React.PureComponent<IProps, IState> {
    private hasVerifier: boolean;

    public constructor(props: IProps) {
        super(props);
        this.state = { sasEvent: null, reciprocateQREvent: null };
        this.hasVerifier = false;
    }

    private renderQRPhase(): JSX.Element {
        const { member, request } = this.props;
        const showSAS: boolean = request.otherPartySupportsMethod(verificationMethods.SAS);
        const showQR: boolean = request.otherPartySupportsMethod(SCAN_QR_CODE_METHOD);
        const qrCodeBytes = showQR ? request.getQRCodeBytes() : null;
        const brand = SdkConfig.get().brand;

        const noCommonMethodError: JSX.Element | null =
            !showSAS && !showQR ? (
                <p>
                    {_t(
                        "The device you are trying to verify doesn't support scanning a " +
                            "QR code or emoji verification, which is what %(brand)s supports. Try " +
                            "with a different client.",
                        { brand },
                    )}
                </p>
            ) : null;

        if (this.props.layout === "dialog") {
            // HACK: This is a terrible idea.
            let qrBlockDialog: JSX.Element | undefined;
            let sasBlockDialog: JSX.Element | undefined;
            if (!!qrCodeBytes) {
                qrBlockDialog = (
                    <div className="mx_VerificationPanel_QRPhase_startOption">
                        <p>{_t("Scan this unique code")}</p>
                        <VerificationQRCode qrCodeBytes={qrCodeBytes} />
                    </div>
                );
            }
            if (showSAS) {
                sasBlockDialog = (
                    <div className="mx_VerificationPanel_QRPhase_startOption">
                        <p>{_t("Compare unique emoji")}</p>
                        <span className="mx_VerificationPanel_QRPhase_helpText">
                            {_t("Compare a unique set of emoji if you don't have a camera on either device")}
                        </span>
                        <AccessibleButton
                            disabled={this.state.emojiButtonClicked}
                            onClick={this.startSAS}
                            kind="primary"
                        >
                            {_t("Start")}
                        </AccessibleButton>
                    </div>
                );
            }
            const or =
                qrBlockDialog && sasBlockDialog ? (
                    <div className="mx_VerificationPanel_QRPhase_betweenText">
                        {_t("%(qrCode)s or %(emojiCompare)s", {
                            emojiCompare: "",
                            qrCode: "",
                        })}
                    </div>
                ) : null;
            return (
                <div>
                    {_t("Verify this device by completing one of the following:")}
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
        if (!!qrCodeBytes) {
            qrBlock = (
                <div className="mx_UserInfo_container">
                    <h3>{_t("Verify by scanning")}</h3>
                    <p>
                        {_t("Ask %(displayName)s to scan your code:", {
                            displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
                        })}
                    </p>

                    <div className="mx_VerificationPanel_qrCode">
                        <VerificationQRCode qrCodeBytes={qrCodeBytes} />
                    </div>
                </div>
            );
        }

        let sasBlock: JSX.Element | undefined;
        if (showSAS) {
            const disabled = this.state.emojiButtonClicked;
            const sasLabel = showQR
                ? _t("If you can't scan the code above, verify by comparing unique emoji.")
                : _t("Verify by comparing unique emoji.");

            // Note: mx_VerificationPanel_verifyByEmojiButton is for the end-to-end tests
            sasBlock = (
                <div className="mx_UserInfo_container">
                    <h3>{_t("Verify by emoji")}</h3>
                    <p>{sasLabel}</p>
                    <AccessibleButton
                        disabled={disabled}
                        kind="primary"
                        className="mx_UserInfo_wideButton mx_VerificationPanel_verifyByEmojiButton"
                        onClick={this.startSAS}
                    >
                        {_t("Verify by emoji")}
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

    private getDevice(): DeviceInfo | null {
        const deviceId = this.props.request && this.props.request.otherDeviceId;
        const userId = MatrixClientPeg.get().getUserId();
        if (deviceId && userId) {
            return MatrixClientPeg.get().getStoredDevice(userId, deviceId);
        } else {
            return null;
        }
    }

    private renderQRReciprocatePhase(): JSX.Element {
        const { member, request } = this.props;
        const description = request.isSelfVerification
            ? _t("Almost there! Is your other device showing the same shield?")
            : _t("Almost there! Is %(displayName)s showing the same shield?", {
                  displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
              });
        let body: JSX.Element;
        if (this.state.reciprocateQREvent) {
            // Element Web doesn't support scanning yet, so assume here we're the client being scanned.
            body = (
                <React.Fragment>
                    <p>{description}</p>
                    <E2EIcon isUser={true} status={E2EState.Verified} size={128} hideTooltip={true} />
                    <div className="mx_VerificationPanel_reciprocateButtons">
                        <AccessibleButton
                            kind="danger"
                            disabled={this.state.reciprocateButtonClicked}
                            onClick={this.onReciprocateNoClick}
                        >
                            {_t("No")}
                        </AccessibleButton>
                        <AccessibleButton
                            kind="primary"
                            disabled={this.state.reciprocateButtonClicked}
                            onClick={this.onReciprocateYesClick}
                        >
                            {_t("Yes")}
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
                <h3>{_t("Verify by scanning")}</h3>
                {body}
            </div>
        );
    }

    private renderVerifiedPhase(): JSX.Element {
        const { member, request } = this.props;

        let text: string | undefined;
        if (!request.isSelfVerification) {
            if (this.props.isRoomEncrypted) {
                text = _t("Verify all users in a room to ensure it's secure.");
            } else {
                text = _t("In encrypted rooms, verify all users to ensure it's secure.");
            }
        }

        let description: string;
        if (request.isSelfVerification) {
            const device = this.getDevice();
            if (!device) {
                // This can happen if the device is logged out while we're still showing verification
                // UI for it.
                logger.warn("Verified device we don't know about: " + this.props.request.otherDeviceId);
                description = _t("You've successfully verified your device!");
            } else {
                description = _t("You've successfully verified %(deviceName)s (%(deviceId)s)!", {
                    deviceName: device ? device.getDisplayName() : "",
                    deviceId: this.props.request.otherDeviceId,
                });
            }
        } else {
            description = _t("You've successfully verified %(displayName)s!", {
                displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
            });
        }

        return (
            <div className="mx_UserInfo_container mx_VerificationPanel_verified_section">
                <p>{description}</p>
                <E2EIcon isUser={true} status={E2EState.Verified} size={128} hideTooltip={true} />
                {text ? <p>{text}</p> : null}
                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    {_t("Got it")}
                </AccessibleButton>
            </div>
        );
    }

    private renderCancelledPhase(): JSX.Element {
        const { member, request } = this.props;

        let startAgainInstruction: string;
        if (request.isSelfVerification) {
            startAgainInstruction = _t("Start verification again from the notification.");
        } else {
            startAgainInstruction = _t("Start verification again from their profile.");
        }

        let text: string;
        if (request.cancellationCode === "m.timeout") {
            text = _t("Verification timed out.") + ` ${startAgainInstruction}`;
        } else if (request.cancellingUserId === request.otherUserId) {
            if (request.isSelfVerification) {
                text = _t("You cancelled verification on your other device.");
            } else {
                text = _t("%(displayName)s cancelled verification.", {
                    displayName: (member as User).displayName || (member as RoomMember).name || member.userId,
                });
            }
            text = `${text} ${startAgainInstruction}`;
        } else {
            text = _t("You cancelled verification.") + ` ${startAgainInstruction}`;
        }

        return (
            <div className="mx_UserInfo_container">
                <h3>{_t("Verification cancelled")}</h3>
                <p>{text}</p>

                <AccessibleButton kind="primary" className="mx_UserInfo_wideButton" onClick={this.props.onClose}>
                    {_t("Got it")}
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
                    case verificationMethods.RECIPROCATE_QR_CODE:
                        return this.renderQRReciprocatePhase();
                    case verificationMethods.SAS: {
                        const emojis = this.state.sasEvent ? (
                            <VerificationShowSas
                                displayName={displayName}
                                device={this.getDevice() ?? undefined}
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
        const verifier = this.props.request.beginKeyVerification(verificationMethods.SAS);
        try {
            await verifier.verify();
        } catch (err) {
            logger.error(err);
        }
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
