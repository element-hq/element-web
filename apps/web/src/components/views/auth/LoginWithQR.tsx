/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    ClientRendezvousFailureReason,
    linkNewDeviceByGeneratingQR,
    MSC4108FailureReason,
    MSC4108SignInWithQR,
    RendezvousError,
    type RendezvousFailureReason,
    RendezvousIntent,
    signInByGeneratingQR,
} from "matrix-js-sdk/src/rendezvous";
import { logger } from "matrix-js-sdk/src/logger";
import { AutoDiscovery, MatrixClient, type XOR } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { Click, Mode, Phase } from "./LoginWithQR-types";
import LoginWithQRFlow from "./LoginWithQRFlow";
import { type CompleteOidcLoginResponse } from "../../../utils/oidc/authorize";

export type QrLoginCredentials = Omit<CompleteOidcLoginResponse, "idTokenClaims"> &
    Awaited<ReturnType<MSC4108SignInWithQR["shareSecrets"]>> & {
        deviceId: string;
    };

type BaseProps = {
    client: MatrixClient;
    mode: Mode;
    onPhaseChange?(phase: Phase): void;
    onFinished(this: void, success?: boolean): void;
};

type Props = XOR<
    {
        intent: RendezvousIntent.LOGIN_ON_NEW_DEVICE;
        clientId?: string; // A spinner will be shown while undefined
        onLoggedIn(credentials: QrLoginCredentials): Promise<void>;
    },
    {
        intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE;
    }
> &
    BaseProps;

interface IState {
    phase: Phase;
    rendezvous?: MSC4108SignInWithQR;
    verificationUri?: string;
    userCode?: string;
    checkCode?: string;
    failureReason?: FailureReason;
    serverNameOrBaseUrl?: string;
}

export enum LoginWithQRFailureReason {
    RateLimited = "rate_limited",
    CheckCodeMismatch = "check_code_mismatch",
}

export type FailureReason = RendezvousFailureReason | LoginWithQRFailureReason;

async function resolveServerURLs(serverNameOrBaseUrl: string): Promise<{
    homeserverUrl?: string;
    identityServerUrl?: string;
}> {
    if (serverNameOrBaseUrl.startsWith("http://") || serverNameOrBaseUrl.startsWith("https://")) {
        // treat as base URL and skip discovery
        return {
            homeserverUrl: serverNameOrBaseUrl,
        };
    }

    // treat as server name and do discovery
    const clientConfig = await AutoDiscovery.findClientConfig(serverNameOrBaseUrl);
    const homeserverUrl = clientConfig?.["m.homeserver"]?.base_url ?? undefined;

    const identityServerUrl = clientConfig?.["m.identity_server"]?.base_url ?? undefined;

    return {
        homeserverUrl,
        identityServerUrl,
    };
}

/**
 * A component that allows sign in and E2EE set up with a QR code.
 *
 * It implements `login.reciprocate` capabilities and showing QR codes.
 *
 * This uses the unstable feature of MSC4108: https://github.com/matrix-org/matrix-spec-proposals/pull/4108
 */
export default class LoginWithQR extends React.Component<Props, IState> {
    private finished = false;
    private abortController?: AbortController;

    public constructor(props: Props) {
        super(props);

        this.state = {
            phase: Phase.Loading,
        };
        this.props.onPhaseChange?.(this.state.phase);
    }

    private readyToLoad(props: Props): boolean {
        return props.intent === RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE || !!props.clientId;
    }

    public componentDidMount(): void {
        if (this.readyToLoad(this.props)) {
            void this.updateMode(this.props.mode);
        }
    }

    public componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<IState>): void {
        if (prevState.phase !== this.state.phase) {
            this.props.onPhaseChange?.(this.state.phase);
        }

        if (prevProps.mode !== this.props.mode || this.readyToLoad(prevProps) !== this.readyToLoad(this.props)) {
            void this.updateMode(this.props.mode);
        }
    }

    private async updateMode(mode: Mode, showLoading = true): Promise<void> {
        this.abortController?.abort();
        this.abortController = new AbortController();
        this.setState({ rendezvous: undefined });
        if (showLoading) {
            this.setState({ phase: Phase.Loading });
        }

        if (mode === Mode.Show) {
            await this.generateAndShowCode(this.abortController);
        }
    }

    public componentWillUnmount(): void {
        if (!this.finished) {
            this.abortController?.abort();
        }
    }

    private onFinished(success: boolean): void {
        this.finished = true;
        if (!success) {
            this.abortController?.abort();
        }
        this.props.onFinished(success);
    }

    private generateAndShowCode = async (abortController: AbortController): Promise<void> => {
        let rendezvous: MSC4108SignInWithQR;
        try {
            rendezvous =
                this.props.intent === RendezvousIntent.LOGIN_ON_NEW_DEVICE
                    ? await signInByGeneratingQR(this.props.client, this.onFailure, abortController.signal)
                    : await linkNewDeviceByGeneratingQR(this.props.client, this.onFailure, abortController.signal);
            if (abortController.signal.aborted) return;
            this.setState({
                phase: Phase.ShowingQR,
                rendezvous,
                failureReason: undefined,
            });
        } catch (e) {
            if (abortController.signal.aborted) return;
            logger.error("Error whilst generating QR code", e);
            this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.HomeserverLacksSupport });
            return;
        }

        try {
            if (this.props.intent === RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE) {
                // MSC4108-Flow: NewScanned
                await rendezvous.negotiateProtocols();
                const { verificationUri } = await rendezvous.deviceAuthorizationGrant();
                this.setState({
                    phase: Phase.OutOfBandConfirmation,
                    verificationUri,
                });
            } else {
                const { serverName } = await rendezvous.negotiateProtocols();
                this.setState({
                    phase: Phase.OutOfBandConfirmation,
                    serverNameOrBaseUrl: serverName,
                });
            }

            // we ask the user to confirm that the channel is secure
        } catch (e: RendezvousError | unknown) {
            if (abortController.signal.aborted) return;
            logger.error("Error whilst approving login", e);
            await rendezvous.cancel(
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
            if (this.props.intent === RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE) {
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
                if (!this.state.serverNameOrBaseUrl) {
                    this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
                    throw new Error("Server name/base URL not found in state");
                }

                // Whilst the 2024 version of MSC4108 says that we always get a server name, in practise the
                // rust-sdk is currently misbehaving and we may receive a base URL instead. Additionally, the 2025
                // version of MSC4108  will always give the base URL.
                // As such, we should be resilient and support both formats until the spec and implementations have
                // stabilised.

                const { homeserverUrl, identityServerUrl } = await resolveServerURLs(this.state.serverNameOrBaseUrl);

                if (!homeserverUrl) {
                    this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
                    logger.error("Failed to discover homeserver URL");
                    throw new Error("Failed to discover homeserver URL");
                }

                // Create a new client as the homeserver URL may not be the same as we used for the secure channel
                const metadata = await new MatrixClient({ baseUrl: homeserverUrl }).getAuthMetadata();

                // Generate our new device ID
                const deviceId = secureRandomString(10);
                const { userCode } = await this.state.rendezvous.deviceAuthorizationGrant({
                    metadata,
                    clientId: this.props.clientId!,
                    deviceId,
                });
                this.setState({ phase: Phase.WaitingForDevice, userCode });

                const tokenResponse = await this.state.rendezvous.completeLoginOnNewDevice({
                    clientId: this.props.clientId!,
                });

                if (tokenResponse) {
                    const { secrets } = await this.state.rendezvous.shareSecrets();

                    await this.props.onLoggedIn({
                        accessToken: tokenResponse.access_token,
                        refreshToken: tokenResponse.refresh_token,
                        homeserverUrl,
                        clientId: this.props.clientId!,
                        idToken: tokenResponse.id_token,
                        issuer: metadata!.issuer,
                        identityServerUrl,
                        secrets,
                        deviceId,
                    });

                    this.onFinished(true);
                }
            }
        } catch (e: RendezvousError | unknown) {
            logger.error("Error whilst approving sign in", e);
            this.setState({
                phase: Phase.Error,
                failureReason: e instanceof RendezvousError ? e.code : ClientRendezvousFailureReason.Unknown,
            });
        }
    };

    private onFailure = async (reason: RendezvousFailureReason): Promise<void> => {
        if (this.state.phase === Phase.Error) return; // Already in failed state
        logger.warn(`Rendezvous failed: ${reason}`);

        // Generate a new rendezvous channel & qr code if we hit expiry whilst still showing the QR code
        if (reason === ClientRendezvousFailureReason.Expired && this.state.phase === Phase.ShowingQR) {
            try {
                this.reset();
                // Add a sleep to make the UX looks less flickery and more intentional
                await sleep(1000);
                await this.updateMode(Mode.Show, false);
                return;
            } catch (e) {
                logger.warn("Failed to re-roll qr code on expiry", e);
            }
        }
        this.setState({ phase: Phase.Error, failureReason: reason });
    };

    public reset(): void {
        this.abortController?.abort();
        this.setState({
            rendezvous: undefined,
            verificationUri: undefined,
            failureReason: undefined,
            userCode: undefined,
        });
    }

    private onClick = async (type: Click, checkCode?: string): Promise<void> => {
        switch (type) {
            case Click.Cancel:
                await this.state.rendezvous?.cancel(MSC4108FailureReason.UserCancelled);
                this.onFinished(false);
                break;
            case Click.Approve:
                await this.approveLogin(checkCode);
                break;
            case Click.Decline:
                if (this.props.intent === RendezvousIntent.LOGIN_ON_NEW_DEVICE) {
                    await this.state.rendezvous?.cancel(MSC4108FailureReason.UserCancelled);
                } else {
                    await this.state.rendezvous?.declineLoginOnExistingDevice();
                }
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
                intent={this.props.intent}
            />
        );
    }
}
