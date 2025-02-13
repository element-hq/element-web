/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import {
    AuthType,
    type IAuthData,
    type AuthDict,
    type IInputs,
    InteractiveAuth,
    type IStageStatus,
} from "matrix-js-sdk/src/interactive-auth";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import getEntryComponentForLoginType, {
    type ContinueKind,
    type CustomAuthType,
    type IStageComponent,
} from "../views/auth/InteractiveAuthEntryComponents";
import Spinner from "../views/elements/Spinner";

export const ERROR_USER_CANCELLED = new Error("User cancelled auth session");

export type InteractiveAuthCallback<T> = {
    (success: true, response: T, extra?: { emailSid?: string; clientSecret?: string }): Promise<void>;
    (success: false, response: IAuthData | Error): Promise<void>;
};

export interface InteractiveAuthProps<T> {
    // matrix client to use for UI auth requests
    matrixClient: MatrixClient;
    // response from initial request. If not supplied, will do a request on mount.
    authData?: IAuthData;
    // Inputs provided by the user to the auth process
    // and used by various stages. As passed to js-sdk
    // interactive-auth
    inputs?: IInputs;
    sessionId?: string;
    clientSecret?: string;
    emailSid?: string;
    // If true, poll to see if the auth flow has been completed out-of-band
    poll?: boolean;
    // continueText and continueKind are passed straight through to the AuthEntryComponent.
    continueText?: string;
    continueKind?: ContinueKind;
    // callback
    makeRequest(auth: AuthDict | null): Promise<T>;
    // callback called when the auth process has finished,
    // successfully or unsuccessfully.
    // @param {boolean} status True if the operation requiring
    //     auth was completed successfully, false if canceled.
    // @param {object} result The result of the authenticated call
    //     if successful, otherwise the error object.
    // @param {object} extra Additional information about the UI Auth
    //     process:
    //      * emailSid {string} If email auth was performed, the sid of
    //            the auth session.
    //      * clientSecret {string} The client secret used in auth
    //            sessions with the ID server.
    onAuthFinished: InteractiveAuthCallback<T>;
    // As js-sdk interactive-auth
    requestEmailToken?(email: string, secret: string, attempt: number, session: string): Promise<{ sid: string }>;
    // Called when the stage changes, or the stage's phase changes. First
    // argument is the stage, second is the phase. Some stages do not have
    // phases and will be counted as 0 (numeric).
    onStagePhaseChange?(stage: AuthType | CustomAuthType | null, phase: number): void;
}

interface IState {
    authStage?: CustomAuthType | AuthType;
    stageState?: IStageStatus;
    busy: boolean;
    errorText?: string;
    errorCode?: string;
    submitButtonEnabled: boolean;
}

export default class InteractiveAuthComponent<T> extends React.Component<InteractiveAuthProps<T>, IState> {
    private readonly authLogic: InteractiveAuth<T>;
    private readonly stageComponent = createRef<IStageComponent>();
    private intervalId: number | null = null;

    private unmounted = false;

    public constructor(props: InteractiveAuthProps<T>) {
        super(props);

        this.state = {
            busy: false,
            submitButtonEnabled: false,
        };

        this.authLogic = new InteractiveAuth<T>({
            authData: this.props.authData,
            doRequest: this.requestCallback,
            busyChanged: this.onBusyChanged,
            inputs: this.props.inputs,
            stateUpdated: this.authStateUpdated,
            matrixClient: this.props.matrixClient,
            sessionId: this.props.sessionId,
            clientSecret: this.props.clientSecret,
            emailSid: this.props.emailSid,
            requestEmailToken: this.requestEmailToken,
            supportedStages: [
                AuthType.Password,
                AuthType.Recaptcha,
                AuthType.Email,
                AuthType.Msisdn,
                AuthType.Terms,
                AuthType.RegistrationToken,
                AuthType.UnstableRegistrationToken,
                AuthType.Sso,
                AuthType.SsoUnstable,
            ],
        });
    }

    public componentDidMount(): void {
        this.unmounted = false;

        if (this.props.poll) {
            this.intervalId = window.setInterval(() => {
                this.authLogic.poll();
            }, 2000);
        }

        this.authLogic
            .attemptAuth()
            .then(async (result) => {
                const extra = {
                    emailSid: this.authLogic.getEmailSid(),
                    clientSecret: this.authLogic.getClientSecret(),
                };
                await this.props.onAuthFinished(true, result, extra);
            })
            .catch(async (error) => {
                await this.props.onAuthFinished(false, error);
                logger.error("Error during user-interactive auth:", error);
                if (this.unmounted) {
                    return;
                }

                const msg = error.message || error.toString();
                this.setState({
                    errorText: msg,
                    errorCode: error.errcode,
                });
            });
    }

    public componentWillUnmount(): void {
        this.unmounted = true;

        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
        }
    }

    private requestEmailToken = async (
        email: string,
        secret: string,
        attempt: number,
        session: string,
    ): Promise<{ sid: string }> => {
        this.setState({
            busy: true,
        });
        try {
            // We know this method only gets called on flows where requestEmailToken is passed but types don't
            return await this.props.requestEmailToken!(email, secret, attempt, session);
        } finally {
            this.setState({
                busy: false,
            });
        }
    };

    private authStateUpdated = (stageType: AuthType, stageState: IStageStatus): void => {
        const oldStage = this.state.authStage;
        this.setState(
            {
                busy: false,
                authStage: stageType,
                stageState: stageState,
                errorText: stageState.error,
                errorCode: stageState.errcode,
            },
            () => {
                if (oldStage !== stageType) {
                    this.setFocus();
                } else if (!stageState.error) {
                    this.stageComponent.current?.attemptFailed?.();
                }
            },
        );
    };

    private requestCallback = (auth: AuthDict | null, background: boolean): Promise<T> => {
        // This wrapper just exists because the js-sdk passes a second
        // 'busy' param for backwards compat. This throws the tests off
        // so discard it here.
        return this.props.makeRequest(auth);
    };

    private onBusyChanged = (busy: boolean): void => {
        // if we've started doing stuff, reset the error messages
        // The JS SDK eagerly reports itself as "not busy" right after any
        // immediate work has completed, but that's not really what we want at
        // the UI layer, so we ignore this signal and show a spinner until
        // there's a new screen to show the user. This is implemented by setting
        // `busy: false` in `authStateUpdated`.
        // See also https://github.com/vector-im/element-web/issues/12546
        if (busy) {
            this.setState({
                busy: true,
                errorText: undefined,
                errorCode: undefined,
            });
        }

        // authStateUpdated is not called during sso flows
        if (!busy && (this.state.authStage === AuthType.Sso || this.state.authStage === AuthType.SsoUnstable)) {
            this.setState({ busy });
        }
    };

    private setFocus(): void {
        this.stageComponent.current?.focus?.();
    }

    private submitAuthDict = (authData: AuthDict): void => {
        this.authLogic.submitAuthDict(authData);
    };

    private onPhaseChange = (newPhase: number): void => {
        this.props.onStagePhaseChange?.(this.state.authStage ?? null, newPhase || 0);
    };

    private onStageCancel = async (): Promise<void> => {
        await this.props.onAuthFinished(false, ERROR_USER_CANCELLED);
    };

    private onAuthStageFailed = async (e: Error): Promise<void> => {
        await this.props.onAuthFinished(false, e);
    };

    private setEmailSid = (sid: string): void => {
        this.authLogic.setEmailSid(sid);
    };

    public render(): React.ReactNode {
        const stage = this.state.authStage;
        if (!stage) {
            if (this.state.busy) {
                return <Spinner />;
            } else {
                return null;
            }
        }

        const StageComponent = getEntryComponentForLoginType(stage);
        return (
            <StageComponent
                ref={this.stageComponent as any}
                loginType={stage}
                matrixClient={this.props.matrixClient}
                authSessionId={this.authLogic.getSessionId()}
                clientSecret={this.authLogic.getClientSecret()}
                stageParams={this.authLogic.getStageParams(stage)}
                submitAuthDict={this.submitAuthDict}
                errorText={this.state.errorText}
                errorCode={this.state.errorCode}
                busy={this.state.busy}
                inputs={this.props.inputs}
                stageState={this.state.stageState}
                fail={this.onAuthStageFailed}
                setEmailSid={this.setEmailSid}
                onPhaseChange={this.onPhaseChange}
                requestEmailToken={this.authLogic.requestEmailToken}
                continueText={this.props.continueText}
                continueKind={this.props.continueKind}
                onCancel={this.onStageCancel}
            />
        );
    }
}
