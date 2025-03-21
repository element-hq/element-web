/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type AuthType, type IAuthData } from "matrix-js-sdk/src/interactive-auth";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import InteractiveAuth, { ERROR_USER_CANCELLED, type InteractiveAuthCallback } from "../../structures/InteractiveAuth";
import { type ContinueKind, SSOAuthEntry } from "../auth/InteractiveAuthEntryComponents";
import StyledCheckbox from "../elements/StyledCheckbox";
import BaseDialog from "./BaseDialog";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

type DialogAesthetics = Partial<{
    [x in AuthType]: {
        [x: number]: {
            body: string;
            continueText?: string;
            continueKind?: ContinueKind;
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
    continueKind?: ContinueKind;
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
    }

    public componentDidMount(): void {
        this.initAuth(/* shouldErase= */ false);
    }

    private onStagePhaseChange = (stage: AuthType, phase: number): void => {
        const dialogAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                body: _t("settings|general|deactivate_confirm_body_sso"),
                continueText: _t("auth|sso"),
                continueKind: "danger",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                body: _t("settings|general|deactivate_confirm_body"),
                continueText: _t("settings|general|deactivate_confirm_continue"),
                continueKind: "danger",
            },
        };

        // This is the same as aestheticsForStagePhases in InteractiveAuthDialog minus the `title`
        const DEACTIVATE_AESTHETICS: DialogAesthetics = {
            [SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics,
        };

        const aesthetics = DEACTIVATE_AESTHETICS[stage];
        let bodyText: string | undefined;
        let continueText: string | undefined;
        let continueKind: ContinueKind | undefined;
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

    private onUIAuthFinished: InteractiveAuthCallback<Awaited<ReturnType<MatrixClient["deactivateAccount"]>>> = async (
        success,
        result,
    ) => {
        if (success) return; // great! makeRequest() will be called too.

        if (result === ERROR_USER_CANCELLED) {
            this.onCancel();
            return;
        }

        logger.error("Error during UI Auth:", { result });
        this.setState({ errStr: _t("settings|general|error_deactivate_communication") });
    };

    private onUIAuthComplete = (auth: IAuthData | null): void => {
        // XXX: this should be returning a promise to maintain the state inside the state machine correct
        // but given that a deactivation is followed by a local logout and all object instances being thrown away
        // this isn't done.
        MatrixClientPeg.safeGet()
            .deactivateAccount(auth ?? undefined, this.state.shouldErase)
            .then((r) => {
                // Deactivation worked - logout & close this dialog
                defaultDispatcher.fire(Action.TriggerLogout);
                this.props.onFinished(true);
            })
            .catch((e) => {
                logger.error(e);
                this.setState({ errStr: _t("settings|general|error_deactivate_communication") });
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
        MatrixClientPeg.safeGet()
            .deactivateAccount(undefined, shouldErase)
            .then((r) => {
                // If we got here, oops. The server didn't require any auth.
                // Our application lifecycle will catch the error and do the logout bits.
                // We'll try to log something in an vain attempt to record what happened (storage
                // is also obliterated on logout).
                logger.warn("User's account got deactivated without confirmation: Server had no auth");
                this.setState({ errStr: _t("settings|general|error_deactivate_no_auth") });
            })
            .catch((e) => {
                if (e && e.httpStatus === 401 && e.data) {
                    // Valid UIA response
                    this.setState({ authData: e.data, authEnabled: true });
                } else {
                    this.setState({ errStr: _t("settings|general|error_deactivate_invalid_auth") });
                }
            });
    }

    public render(): React.ReactNode {
        let error: JSX.Element | undefined;
        if (this.state.errStr) {
            error = <div className="error">{this.state.errStr}</div>;
        }

        let auth = <div>{_t("common|loading")}</div>;
        if (this.state.authData && this.state.authEnabled) {
            auth = (
                <div>
                    {this.state.bodyText}
                    <InteractiveAuth
                        matrixClient={MatrixClientPeg.safeGet()}
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
                title={_t("settings|general|deactivate_section")}
                screenName="DeactivateAccount"
            >
                <div className="mx_Dialog_content">
                    <p>{_t("settings|general|deactivate_confirm_content")}</p>
                    <ul>
                        <li>{_t("settings|general|deactivate_confirm_content_1")}</li>
                        <li>{_t("settings|general|deactivate_confirm_content_2")}</li>
                        <li>{_t("settings|general|deactivate_confirm_content_3")}</li>
                        <li>{_t("settings|general|deactivate_confirm_content_4")}</li>
                        <li>{_t("settings|general|deactivate_confirm_content_5")}</li>
                    </ul>
                    <p>{_t("settings|general|deactivate_confirm_content_6")}</p>

                    <div className="mx_DeactivateAccountDialog_input_section">
                        <p>
                            <StyledCheckbox checked={this.state.shouldErase} onChange={this.onEraseFieldChange}>
                                {_t("settings|general|deactivate_confirm_erase_label")}
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
