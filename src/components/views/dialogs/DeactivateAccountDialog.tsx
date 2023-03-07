/*
Copyright 2016 OpenMarket Ltd
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
import { AuthType, IAuthData } from "matrix-js-sdk/src/interactive-auth";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import InteractiveAuth, { ERROR_USER_CANCELLED, InteractiveAuthCallback } from "../../structures/InteractiveAuth";
import { DEFAULT_PHASE, PasswordAuthEntry, SSOAuthEntry } from "../auth/InteractiveAuthEntryComponents";
import StyledCheckbox from "../elements/StyledCheckbox";
import BaseDialog from "./BaseDialog";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

type DialogAesthetics = Partial<{
    [x in AuthType]: {
        [x: number]: {
            body: string;
            continueText?: string;
            continueKind?: string;
        };
    };
}>;

interface IProps {
    onFinished: (success?: boolean) => void;
}

interface IState {
    shouldErase: boolean;
    errStr: string | null;
    authData: any; // for UIA
    authEnabled: boolean; // see usages for information

    // A few strings that are passed to InteractiveAuth for design or are displayed
    // next to the InteractiveAuth component.
    bodyText?: string;
    continueText?: string;
    continueKind?: string;
}

export default class DeactivateAccountDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            shouldErase: false,
            errStr: null,
            authData: null, // for UIA
            authEnabled: true, // see usages for information
        };

        this.initAuth(/* shouldErase= */ false);
    }

    private onStagePhaseChange = (stage: AuthType, phase: number): void => {
        const dialogAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                body: _t("Confirm your account deactivation by using Single Sign On to prove your identity."),
                continueText: _t("Single Sign On"),
                continueKind: "danger",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                body: _t("Are you sure you want to deactivate your account? This is irreversible."),
                continueText: _t("Confirm account deactivation"),
                continueKind: "danger",
            },
        };

        // This is the same as aestheticsForStagePhases in InteractiveAuthDialog minus the `title`
        const DEACTIVATE_AESTHETICS: DialogAesthetics = {
            [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
            [PasswordAuthEntry.LOGIN_TYPE]: {
                [DEFAULT_PHASE]: {
                    body: _t("To continue, please enter your account password:"),
                },
            },
        };

        const aesthetics = DEACTIVATE_AESTHETICS[stage];
        let bodyText: string | undefined;
        let continueText: string | undefined;
        let continueKind: string | undefined;
        if (aesthetics) {
            const phaseAesthetics = aesthetics[phase];
            if (phaseAesthetics) {
                if (phaseAesthetics.body) bodyText = phaseAesthetics.body;
                if (phaseAesthetics.continueText) continueText = phaseAesthetics.continueText;
                if (phaseAesthetics.continueKind) continueKind = phaseAesthetics.continueKind;
            }
        }
        this.setState({ bodyText, continueText, continueKind });
    };

    private onUIAuthFinished: InteractiveAuthCallback = (success, result) => {
        if (success) return; // great! makeRequest() will be called too.

        if (result === ERROR_USER_CANCELLED) {
            this.onCancel();
            return;
        }

        logger.error("Error during UI Auth:", { result });
        this.setState({ errStr: _t("There was a problem communicating with the server. Please try again.") });
    };

    private onUIAuthComplete = (auth: IAuthData | null): void => {
        // XXX: this should be returning a promise to maintain the state inside the state machine correct
        // but given that a deactivation is followed by a local logout and all object instances being thrown away
        // this isn't done.
        MatrixClientPeg.get()
            .deactivateAccount(auth, this.state.shouldErase)
            .then((r) => {
                // Deactivation worked - logout & close this dialog
                defaultDispatcher.fire(Action.TriggerLogout);
                this.props.onFinished(true);
            })
            .catch((e) => {
                logger.error(e);
                this.setState({ errStr: _t("There was a problem communicating with the server. Please try again.") });
            });
    };

    private onEraseFieldChange = (ev: React.FormEvent<HTMLInputElement>): void => {
        this.setState({
            shouldErase: ev.currentTarget.checked,

            // Disable the auth form because we're going to have to reinitialize the auth
            // information. We do this because we can't modify the parameters in the UIA
            // session, and the user will have selected something which changes the request.
            // Therefore, we throw away the last auth session and try a new one.
            authEnabled: false,
        });

        // As mentioned above, set up for auth again to get updated UIA session info
        this.initAuth(/* shouldErase= */ ev.currentTarget.checked);
    };

    private onCancel(): void {
        this.props.onFinished(false);
    }

    private initAuth(shouldErase: boolean): void {
        MatrixClientPeg.get()
            .deactivateAccount(null, shouldErase)
            .then((r) => {
                // If we got here, oops. The server didn't require any auth.
                // Our application lifecycle will catch the error and do the logout bits.
                // We'll try to log something in an vain attempt to record what happened (storage
                // is also obliterated on logout).
                logger.warn("User's account got deactivated without confirmation: Server had no auth");
                this.setState({ errStr: _t("Server did not require any authentication") });
            })
            .catch((e) => {
                if (e && e.httpStatus === 401 && e.data) {
                    // Valid UIA response
                    this.setState({ authData: e.data, authEnabled: true });
                } else {
                    this.setState({ errStr: _t("Server did not return valid authentication information.") });
                }
            });
    }

    public render(): React.ReactNode {
        let error: JSX.Element | undefined;
        if (this.state.errStr) {
            error = <div className="error">{this.state.errStr}</div>;
        }

        let auth = <div>{_t("Loading…")}</div>;
        if (this.state.authData && this.state.authEnabled) {
            auth = (
                <div>
                    {this.state.bodyText}
                    <InteractiveAuth
                        matrixClient={MatrixClientPeg.get()}
                        authData={this.state.authData}
                        // XXX: onUIAuthComplete breaches the expected method contract, it gets away with it because it
                        // knows the entire app is about to die as a result of the account deactivation.
                        makeRequest={this.onUIAuthComplete as any}
                        onAuthFinished={this.onUIAuthFinished}
                        onStagePhaseChange={this.onStagePhaseChange}
                        continueText={this.state.continueText}
                        continueKind={this.state.continueKind}
                    />
                </div>
            );
        }

        // this is on purpose not a <form /> to prevent Enter triggering submission, to further prevent accidents
        return (
            <BaseDialog
                className="mx_DeactivateAccountDialog"
                onFinished={this.props.onFinished}
                titleClass="danger"
                title={_t("Deactivate Account")}
                screenName="DeactivateAccount"
            >
                <div className="mx_Dialog_content">
                    <p>{_t("Confirm that you would like to deactivate your account. If you proceed:")}</p>
                    <ul>
                        <li>{_t("You will not be able to reactivate your account")}</li>
                        <li>{_t("You will no longer be able to log in")}</li>
                        <li>
                            {_t(
                                "No one will be able to reuse your username (MXID), including you: this username will remain unavailable",
                            )}
                        </li>
                        <li>{_t("You will leave all rooms and DMs that you are in")}</li>
                        <li>
                            {_t(
                                "You will be removed from the identity server: your friends will no longer be able to find you with your email or phone number",
                            )}
                        </li>
                    </ul>
                    <p>
                        {_t(
                            "Your old messages will still be visible to people who received them, just like emails you sent in the past. Would you like to hide your sent messages from people who join rooms in the future?",
                        )}
                    </p>

                    <div className="mx_DeactivateAccountDialog_input_section">
                        <p>
                            <StyledCheckbox checked={this.state.shouldErase} onChange={this.onEraseFieldChange}>
                                {_t("Hide my messages from new joiners")}
                            </StyledCheckbox>
                        </p>
                        {error}
                        {auth}
                    </div>
                </div>
            </BaseDialog>
        );
    }
}
