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
import { AutoDiscovery, MatrixClient, OAuthGrantType, type OidcClientConfig, type XOR } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { Click, Mode, Phase } from "./LoginWithQR-types";
import LoginWithQRFlow from "./LoginWithQRFlow";
import { type CompleteOidcLoginResponse } from "../../../utils/oidc/authorize";
import { getOidcClientId } from "../../../utils/oidc/registerClient.ts";
import SdkConfig from "../../../SdkConfig.ts";

export type QrLoginCredentials = Omit<CompleteOidcLoginResponse, "idTokenClaims"> &
    Awaited<ReturnType<MSC4108SignInWithQR["shareSecrets"]>> & {
        deviceId: string;
    };

type BaseProps = {
    /**
     * The MatrixClient to use for the rendezvous communication with the other device.
     */
    client: MatrixClient;
    /**
     * Whether to show a QR code or facilitate scanning one. Only Mode.Show is currently supported.
     */
    mode: Mode;
    /**
     * Callback when the internal phase state has changed
     * @param phase - the new phase which is being entered
     */
    onPhaseChange?(phase: Phase): void;
    /**
     * Callback when the flow is concluded
     * @param success - whether it was successful
     */
    onFinished(this: void, success?: boolean): void;
};

type Props = XOR<
    {
        /**
         * Intent to facilitate logging into this device from an existing device
         */
        intent: RendezvousIntent.LOGIN_ON_NEW_DEVICE;
        /**
         * Callback for successful login
         * @param credentials - the credentials to authenticate with
         */
        onLoggedIn(credentials: QrLoginCredentials): Promise<void>;
    },
    {
        /**
         * Intent to facilitate logging into another device from this existing device
         */
        intent: RendezvousIntent.RECIPROCATE_LOGIN_ON_EXISTING_DEVICE;
    }
> &
    BaseProps;

interface IState {
    /**
     * The current phase of the flow
     */
    phase: Phase;
    /**
     * The rendezvous channel in use
     */
    rendezvous?: MSC4108SignInWithQR;
    /**
     * TODO
     */
    verificationUri?: string;
    /**
     * TODO
     */
    userCode?: string;
    /**
     * TODO
     */
    checkCode?: string;
    /**
     * TODO
     */
    failureReason?: FailureReason;
    /**
     * TODO
     */
    loginServerDetails?: {
        /**
         * TODO
         */
        homeserverUrl: string;
        /**
         * TODO
         */
        identityServerUrl?: string;
        /**
         * TODO
         */
        metadata: OidcClientConfig;
        /**
         * TODO
         */
        clientId: string;
    };
}

export enum LoginWithQRFailureReason {
    RateLimited = "rate_limited",
    CheckCodeMismatch = "check_code_mismatch",
}

export type FailureReason = RendezvousFailureReason | LoginWithQRFailureReason;

/**
 * Resolve a server name or baseURL to the homeserver & identity server URLs.
 * @param serverNameOrBaseUrl the name or URL to resolve
 * Whilst the 2024 version of MSC4108 says that we always get a server name, in practise the
 * rust-sdk is currently misbehaving and we may receive a base URL instead. Additionally, the 2025
 * version of MSC4108  will always give the base URL.
 * As such, we should be resilient and support both formats until the spec and implementations have
 * stabilised.
 */
async function resolveServerURLs(
    serverNameOrBaseUrl: string,
): Promise<Pick<Partial<NonNullable<IState["loginServerDetails"]>>, "homeserverUrl" | "identityServerUrl">> {
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
 * It implements `login.reciprocate` & `login.start` capabilities and showing QR codes.
 * It does not implement any flows requiring the scanning of QR codes.
 *
 * Implements the v2024 version of MSC4108: https://github.com/matrix-org/matrix-spec-proposals/pull/4108
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

    public componentDidMount(): void {
        void this.updateMode(this.props.mode);
    }

    public componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<IState>): void {
        if (prevState.phase !== this.state.phase) {
            this.props.onPhaseChange?.(this.state.phase);
        }

        if (prevProps.mode !== this.props.mode) {
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
                const { homeserverUrl, identityServerUrl } = await resolveServerURLs(serverName!);

                if (!homeserverUrl) {
                    this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
                    logger.error("Failed to discover homeserver URL");
                    throw new Error("Failed to discover homeserver URL");
                }

                let metadata: OidcClientConfig;
                let clientId: string;
                try {
                    // Create a new client as the homeserver URL may not be the same as we used for the secure channel
                    metadata = await new MatrixClient({ baseUrl: homeserverUrl }).getAuthMetadata();
                    if (!metadata.grant_types_supported.includes(OAuthGrantType.DeviceAuthorization)) {
                        throw new Error("Server does not support Device Authorization Grant");
                    }
                    clientId = await getOidcClientId(metadata, SdkConfig.get().oidc_static_clients);
                } catch (e) {
                    this.setState({
                        phase: Phase.Error,
                        failureReason: ClientRendezvousFailureReason.HomeserverLacksSupport,
                    });
                    logger.error("Failed to register OIDC Client ID", e);
                    throw new Error("Failed to register OIDC Client ID", { cause: e });
                }

                this.setState({
                    phase: Phase.OutOfBandConfirmation,
                    loginServerDetails: {
                        homeserverUrl,
                        identityServerUrl,
                        metadata,
                        clientId,
                    },
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
                if (!this.state.loginServerDetails) {
                    this.setState({ phase: Phase.Error, failureReason: ClientRendezvousFailureReason.Unknown });
                    throw new Error("Server details not found in state");
                }

                const { homeserverUrl, identityServerUrl, clientId, metadata } = this.state.loginServerDetails;

                // Generate our new device ID
                const deviceId = secureRandomString(10);
                const { userCode } = await this.state.rendezvous.deviceAuthorizationGrant({
                    metadata,
                    clientId,
                    deviceId,
                });
                this.setState({ phase: Phase.WaitingForDevice, userCode });

                const tokenResponse = await this.state.rendezvous.completeLoginOnNewDevice({ clientId });

                if (tokenResponse) {
                    const { secrets } = await this.state.rendezvous.shareSecrets();

                    await this.props.onLoggedIn({
                        accessToken: tokenResponse.access_token,
                        refreshToken: tokenResponse.refresh_token,
                        homeserverUrl,
                        clientId,
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
