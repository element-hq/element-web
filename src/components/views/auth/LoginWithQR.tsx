/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    ClientRendezvousFailureReason,
    MSC4108FailureReason,
    MSC4108RendezvousSession,
    MSC4108SecureChannel,
    MSC4108SignInWithQR,
    RendezvousError,
    type RendezvousFailureReason,
    RendezvousIntent,
} from "matrix-js-sdk/src/rendezvous";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { Click, Mode, Phase } from "./LoginWithQR-types";
import LoginWithQRFlow from "./LoginWithQRFlow";

interface IProps {
    client: MatrixClient;
    mode: Mode;
    onFinished(...args: any): void;
}

interface IState {
    phase: Phase;
    rendezvous?: MSC4108SignInWithQR;
    mediaPermissionError?: boolean;
    verificationUri?: string;
    userCode?: string;
    checkCode?: string;
    failureReason?: FailureReason;
}

export enum LoginWithQRFailureReason {
    RateLimited = "rate_limited",
    CheckCodeMismatch = "check_code_mismatch",
}

export type FailureReason = RendezvousFailureReason | LoginWithQRFailureReason;

/**
 * A component that allows sign in and E2EE set up with a QR code.
 *
 * It implements `login.reciprocate` capabilities and showing QR codes.
 *
 * This uses the unstable feature of MSC4108: https://github.com/matrix-org/matrix-spec-proposals/pull/4108
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
            this.state.rendezvous.cancel(MSC4108FailureReason.UserCancelled);
        }
    }

    private onFinished(success: boolean): void {
        this.finished = true;
        this.props.onFinished(success);
    }

    private generateAndShowCode = async (): Promise<void> => {
        let rendezvous: MSC4108SignInWithQR;
        try {
            const transport = new MSC4108RendezvousSession({
                onFailure: this.onFailure,
                client: this.props.client,
            });
            await transport.send("");
            const channel = new MSC4108SecureChannel(transport, undefined, this.onFailure);
            rendezvous = new MSC4108SignInWithQR(channel, false, this.props.client, this.onFailure);

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
            if (this.ourIntent === RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE) {
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
            await rendezvous?.cancel(
                e instanceof RendezvousError ? (e.code as MSC4108FailureReason) : ClientRendezvousFailureReason.Unknown,
            );
        }
    };

    private approveLogin = async (checkCode: string | undefined): Promise<void> => {
        if (!(this.state.rendezvous instanceof MSC4108SignInWithQR)) {
            this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
            throw new Error("Rendezvous not found");
        }

        if (this.state.rendezvous?.checkCode !== checkCode) {
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
            verificationUri: undefined,
            failureReason: undefined,
            userCode: undefined,
            checkCode: undefined,
            mediaPermissionError: false,
        });
    }

    private onClick = async (type: Click, checkCode?: string): Promise<void> => {
        switch (type) {
            case Click.Cancel:
                await this.state.rendezvous?.cancel(MSC4108FailureReason.UserCancelled);
                this.reset();
                this.onFinished(false);
                break;
            case Click.Approve:
                await this.approveLogin(checkCode);
                break;
            case Click.Decline:
                await this.state.rendezvous?.declineLoginOnExistingDevice();
                this.reset();
                this.onFinished(false);
                break;
            case Click.Back:
                await this.state.rendezvous?.cancel(MSC4108FailureReason.UserCancelled);
                this.onFinished(false);
                break;
            case Click.ShowQr:
                await this.updateMode(Mode.Show);
                break;
        }
    };

    public render(): React.ReactNode {
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
