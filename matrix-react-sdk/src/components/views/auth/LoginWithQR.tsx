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
import { MSC3906Rendezvous, MSC3906RendezvousPayload, RendezvousFailureReason } from "matrix-js-sdk/src/rendezvous";
import { MSC3886SimpleHttpRendezvousTransport } from "matrix-js-sdk/src/rendezvous/transports";
import { MSC3903ECDHPayload, MSC3903ECDHv2RendezvousChannel } from "matrix-js-sdk/src/rendezvous/channels";
import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/client";

import { _t } from "../../../languageHandler";
import { wrapRequestWithDialog } from "../../../utils/UserInteractiveAuth";
import LoginWithQRFlow from "./LoginWithQRFlow";

/**
 * The intention of this enum is to have a mode that scans a QR code instead of generating one.
 */
export enum Mode {
    /**
     * A QR code with be generated and shown
     */
    Show = "show",
}

export enum Phase {
    Loading,
    ShowingQR,
    Connecting,
    Connected,
    WaitingForDevice,
    Verifying,
    Error,
}

export enum Click {
    Cancel,
    Decline,
    Approve,
    TryAgain,
    Back,
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
 * It implements `login.reciprocate` capabilities and showing QR codes.
 *
 * This uses the unstable feature of MSC3906: https://github.com/matrix-org/matrix-spec-proposals/pull/3906
 */
export default class LoginWithQR extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
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

    private async updateMode(mode: Mode): Promise<void> {
        this.setState({ phase: Phase.Loading });
        if (this.state.rendezvous) {
            const rendezvous = this.state.rendezvous;
            rendezvous.onFailure = undefined;
            await rendezvous.cancel(RendezvousFailureReason.UserCancelled);
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
            throw new Error("Rendezvous not found");
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
            this.setState({ phase: Phase.Verifying });
            await this.state.rendezvous.verifyNewDeviceOnExistingDevice();
            this.props.onFinished(true);
        } catch (e) {
            logger.error("Error whilst approving sign in", e);
            this.setState({ phase: Phase.Error, failureReason: RendezvousFailureReason.Unknown });
        }
    };

    private generateCode = async (): Promise<void> => {
        let rendezvous: MSC3906Rendezvous;
        try {
            const transport = new MSC3886SimpleHttpRendezvousTransport<MSC3903ECDHPayload>({
                onFailure: this.onFailure,
                client: this.props.client,
            });

            const channel = new MSC3903ECDHv2RendezvousChannel<MSC3906RendezvousPayload>(
                transport,
                undefined,
                this.onFailure,
            );

            rendezvous = new MSC3906Rendezvous(channel, this.props.client, this.onFailure);

            await rendezvous.generateCode();
            this.setState({
                phase: Phase.ShowingQR,
                rendezvous,
                failureReason: undefined,
            });
        } catch (e) {
            logger.error("Error whilst generating QR code", e);
            this.setState({ phase: Phase.Error, failureReason: RendezvousFailureReason.HomeserverLacksSupport });
            return;
        }

        try {
            const confirmationDigits = await rendezvous.startAfterShowingCode();
            this.setState({ phase: Phase.Connected, confirmationDigits });
        } catch (e) {
            logger.error("Error whilst doing QR login", e);
            // only set to error phase if it hasn't already been set by onFailure or similar
            if (this.state.phase !== Phase.Error) {
                this.setState({ phase: Phase.Error, failureReason: RendezvousFailureReason.Unknown });
            }
        }
    };

    private onFailure = (reason: RendezvousFailureReason): void => {
        logger.info(`Rendezvous failed: ${reason}`);
        this.setState({ phase: Phase.Error, failureReason: reason });
    };

    public reset(): void {
        this.setState({
            rendezvous: undefined,
            confirmationDigits: undefined,
            failureReason: undefined,
        });
    }

    private onClick = async (type: Click): Promise<void> => {
        switch (type) {
            case Click.Cancel:
                await this.state.rendezvous?.cancel(RendezvousFailureReason.UserCancelled);
                this.reset();
                this.props.onFinished(false);
                break;
            case Click.Approve:
                await this.approveLogin();
                break;
            case Click.Decline:
                await this.state.rendezvous?.declineLoginOnExistingDevice();
                this.reset();
                this.props.onFinished(false);
                break;
            case Click.TryAgain:
                this.reset();
                await this.updateMode(this.props.mode);
                break;
            case Click.Back:
                await this.state.rendezvous?.cancel(RendezvousFailureReason.UserCancelled);
                this.props.onFinished(false);
                break;
        }
    };

    public render(): React.ReactNode {
        return (
            <LoginWithQRFlow
                onClick={this.onClick}
                phase={this.state.phase}
                code={this.state.phase === Phase.ShowingQR ? this.state.rendezvous?.code : undefined}
                confirmationDigits={this.state.phase === Phase.Connected ? this.state.confirmationDigits : undefined}
                failureReason={this.state.phase === Phase.Error ? this.state.failureReason : undefined}
            />
        );
    }
}
