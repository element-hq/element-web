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
import {
    ClientRendezvousFailureReason,
    LegacyRendezvousFailureReason,
    MSC3886SimpleHttpRendezvousTransport,
    MSC3903ECDHPayload,
    MSC3903ECDHv2RendezvousChannel,
    MSC3906Rendezvous,
    MSC4108FailureReason,
    MSC4108RendezvousSession,
    MSC4108SecureChannel,
    MSC4108SignInWithQR,
    RendezvousError,
    RendezvousFailureReason,
    RendezvousIntent,
} from "matrix-js-sdk/src/rendezvous";
import { logger } from "matrix-js-sdk/src/logger";
import { HTTPError, MatrixClient } from "matrix-js-sdk/src/matrix";

import { Click, Mode, Phase } from "./LoginWithQR-types";
import LoginWithQRFlow from "./LoginWithQRFlow";
import { wrapRequestWithDialog } from "../../../utils/UserInteractiveAuth";
import { _t } from "../../../languageHandler";

interface IProps {
    client: MatrixClient;
    mode: Mode;
    legacy: boolean;
    onFinished(...args: any): void;
}

interface IState {
    phase: Phase;
    rendezvous?: MSC3906Rendezvous | MSC4108SignInWithQR;
    mediaPermissionError?: boolean;

    // MSC3906
    confirmationDigits?: string;

    // MSC4108
    verificationUri?: string;
    userCode?: string;
    checkCode?: string;
    failureReason?: FailureReason;
    lastScannedCode?: Buffer;
}

export enum LoginWithQRFailureReason {
    /**
     * @deprecated the MSC3906 implementation is deprecated in favour of MSC4108.
     */
    RateLimited = "rate_limited",
    CheckCodeMismatch = "check_code_mismatch",
}

export type FailureReason = RendezvousFailureReason | LoginWithQRFailureReason;

// n.b MSC3886/MSC3903/MSC3906 that this is based on are now closed.
// However, we want to keep this implementation around for some time.
// TODO: define an end-of-life date for this implementation.

/**
 * A component that allows sign in and E2EE set up with a QR code.
 *
 * It implements `login.reciprocate` capabilities and showing QR codes.
 *
 * This uses the unstable feature of MSC3906: https://github.com/matrix-org/matrix-spec-proposals/pull/3906
 */
export default class LoginWithQR extends React.Component<IProps, IState> {
    private finished = false;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phase.Loading,
        };
    }

    private get ourIntent(): RendezvousIntent {
        return RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE;
    }

    public componentDidMount(): void {
        this.updateMode(this.props.mode).then(() => {});
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.mode !== this.props.mode) {
            this.updateMode(this.props.mode).then(() => {});
        }
    }

    private async updateMode(mode: Mode): Promise<void> {
        this.setState({ phase: Phase.Loading });
        if (this.state.rendezvous) {
            const rendezvous = this.state.rendezvous;
            rendezvous.onFailure = undefined;
            if (rendezvous instanceof MSC3906Rendezvous) {
                await rendezvous.cancel(LegacyRendezvousFailureReason.UserCancelled);
            }
            this.setState({ rendezvous: undefined });
        }
        if (mode === Mode.Show) {
            await this.generateAndShowCode();
        }
    }

    public componentWillUnmount(): void {
        if (this.state.rendezvous && !this.finished) {
            // eslint-disable-next-line react/no-direct-mutation-state
            this.state.rendezvous.onFailure = undefined;
            // calling cancel will call close() as well to clean up the resources
            if (this.state.rendezvous instanceof MSC3906Rendezvous) {
                this.state.rendezvous.cancel(LegacyRendezvousFailureReason.UserCancelled);
            } else {
                this.state.rendezvous.cancel(MSC4108FailureReason.UserCancelled);
            }
        }
    }

    private async legacyApproveLogin(): Promise<void> {
        if (!(this.state.rendezvous instanceof MSC3906Rendezvous)) {
            throw new Error("Rendezvous not found");
        }
        if (!this.props.client) {
            throw new Error("No client to approve login with");
        }
        this.setState({ phase: Phase.Loading });

        try {
            logger.info("Requesting login token");

            const { login_token: loginToken } = await wrapRequestWithDialog(this.props.client.requestLoginToken, {
                matrixClient: this.props.client,
                title: _t("auth|qr_code_login|sign_in_new_device"),
            })();

            this.setState({ phase: Phase.WaitingForDevice });

            const newDeviceId = await this.state.rendezvous.approveLoginOnExistingDevice(loginToken);
            if (!newDeviceId) {
                // user denied
                return;
            }
            if (!this.props.client.getCrypto()) {
                // no E2EE to set up
                this.onFinished(true);
                return;
            }
            this.setState({ phase: Phase.Verifying });
            await this.state.rendezvous.verifyNewDeviceOnExistingDevice();
            // clean up our state:
            try {
                await this.state.rendezvous.close();
            } finally {
                this.setState({ rendezvous: undefined });
            }
            this.onFinished(true);
        } catch (e) {
            logger.error("Error whilst approving sign in", e);
            if (e instanceof HTTPError && e.httpStatus === 429) {
                // 429: rate limit
                this.setState({ phase: Phase.Error, failureReason: LoginWithQRFailureReason.RateLimited });
                return;
            }
            this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
        }
    }

    private onFinished(success: boolean): void {
        this.finished = true;
        this.props.onFinished(success);
    }

    private generateAndShowCode = async (): Promise<void> => {
        let rendezvous: MSC4108SignInWithQR | MSC3906Rendezvous;
        try {
            const fallbackRzServer = this.props.client?.getClientWellKnown()?.["io.element.rendezvous"]?.server;

            if (this.props.legacy) {
                const transport = new MSC3886SimpleHttpRendezvousTransport<MSC3903ECDHPayload>({
                    onFailure: this.onFailure,
                    client: this.props.client,
                    fallbackRzServer,
                });
                const channel = new MSC3903ECDHv2RendezvousChannel(transport, undefined, this.onFailure);
                rendezvous = new MSC3906Rendezvous(channel, this.props.client, this.onFailure);
            } else {
                const transport = new MSC4108RendezvousSession({
                    onFailure: this.onFailure,
                    client: this.props.client,
                    fallbackRzServer,
                });
                await transport.send("");
                const channel = new MSC4108SecureChannel(transport, undefined, this.onFailure);
                rendezvous = new MSC4108SignInWithQR(channel, false, this.props.client, this.onFailure);
            }

            await rendezvous.generateCode();
            this.setState({
                phase: Phase.ShowingQR,
                rendezvous,
                failureReason: undefined,
            });
        } catch (e) {
            logger.error("Error whilst generating QR code", e);
            this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.HomeserverLacksSupport });
            return;
        }

        try {
            if (rendezvous instanceof MSC3906Rendezvous) {
                const confirmationDigits = await rendezvous.startAfterShowingCode();
                this.setState({ phase: Phase.LegacyConnected, confirmationDigits });
            } else if (this.ourIntent === RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE) {
                // MSC4108-Flow: NewScanned
                await rendezvous.negotiateProtocols();
                const { verificationUri } = await rendezvous.deviceAuthorizationGrant();
                this.setState({
                    phase: Phase.OutOfBandConfirmation,
                    verificationUri,
                });
            }

            // we ask the user to confirm that the channel is secure
        } catch (e: RendezvousError | unknown) {
            logger.error("Error whilst approving login", e);
            if (rendezvous instanceof MSC3906Rendezvous) {
                // only set to error phase if it hasn't already been set by onFailure or similar
                if (this.state.phase !== Phase.Error) {
                    this.setState({ phase: Phase.Error, failureReason: LegacyRendezvousFailureReason.Unknown });
                }
            } else {
                await rendezvous?.cancel(
                    e instanceof RendezvousError
                        ? (e.code as MSC4108FailureReason)
                        : ClientRendezvousFailureReason.Unknown,
                );
            }
        }
    };

    private approveLogin = async (checkCode: string | undefined): Promise<void> => {
        if (!(this.state.rendezvous instanceof MSC4108SignInWithQR)) {
            this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
            throw new Error("Rendezvous not found");
        }

        if (!this.state.lastScannedCode && this.state.rendezvous?.checkCode !== checkCode) {
            this.setState({ failureReason: LoginWithQRFailureReason.CheckCodeMismatch });
            return;
        }

        try {
            if (this.ourIntent === RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE) {
                // MSC4108-Flow: NewScanned
                this.setState({ phase: Phase.Loading });

                if (this.state.verificationUri) {
                    window.open(this.state.verificationUri, "_blank");
                }

                this.setState({ phase: Phase.WaitingForDevice });

                // send secrets
                await this.state.rendezvous.shareSecrets();

                // done
                this.onFinished(true);
            } else {
                this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
                throw new Error("New device flows around OIDC are not yet implemented");
            }
        } catch (e: RendezvousError | unknown) {
            logger.error("Error whilst approving sign in", e);
            this.setState({
                phase: Phase.Error,
                failureReason: e instanceof RendezvousError ? e.code : ClientRendezvousFailureReason.Unknown,
            });
        }
    };

    private onFailure = (reason: RendezvousFailureReason): void => {
        if (this.state.phase === Phase.Error) return; // Already in failed state
        logger.info(`Rendezvous failed: ${reason}`);
        this.setState({ phase: Phase.Error, failureReason: reason });
    };

    public reset(): void {
        this.setState({
            rendezvous: undefined,
            confirmationDigits: undefined,
            verificationUri: undefined,
            failureReason: undefined,
            userCode: undefined,
            checkCode: undefined,
            lastScannedCode: undefined,
            mediaPermissionError: false,
        });
    }

    private onClick = async (type: Click, checkCode?: string): Promise<void> => {
        switch (type) {
            case Click.Cancel:
                if (this.state.rendezvous instanceof MSC3906Rendezvous) {
                    await this.state.rendezvous?.cancel(LegacyRendezvousFailureReason.UserCancelled);
                } else {
                    await this.state.rendezvous?.cancel(MSC4108FailureReason.UserCancelled);
                }
                this.reset();
                this.onFinished(false);
                break;
            case Click.Approve:
                await (this.props.legacy ? this.legacyApproveLogin() : this.approveLogin(checkCode));
                break;
            case Click.Decline:
                await this.state.rendezvous?.declineLoginOnExistingDevice();
                this.reset();
                this.onFinished(false);
                break;
            case Click.Back:
                if (this.state.rendezvous instanceof MSC3906Rendezvous) {
                    await this.state.rendezvous?.cancel(LegacyRendezvousFailureReason.UserCancelled);
                } else {
                    await this.state.rendezvous?.cancel(MSC4108FailureReason.UserCancelled);
                }
                this.onFinished(false);
                break;
            case Click.ShowQr:
                await this.updateMode(Mode.Show);
                break;
        }
    };

    public render(): React.ReactNode {
        if (this.state.rendezvous instanceof MSC3906Rendezvous) {
            return (
                <LoginWithQRFlow
                    onClick={this.onClick}
                    phase={this.state.phase}
                    code={this.state.phase === Phase.ShowingQR ? this.state.rendezvous?.code : undefined}
                    confirmationDigits={
                        this.state.phase === Phase.LegacyConnected ? this.state.confirmationDigits : undefined
                    }
                    failureReason={this.state.failureReason}
                />
            );
        }

        return (
            <LoginWithQRFlow
                onClick={this.onClick}
                phase={this.state.phase}
                code={this.state.phase === Phase.ShowingQR ? this.state.rendezvous?.code : undefined}
                failureReason={this.state.failureReason}
                userCode={this.state.userCode}
                checkCode={this.state.checkCode}
            />
        );
    }
}
