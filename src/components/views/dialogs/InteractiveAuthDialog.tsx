/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type AuthType } from "matrix-js-sdk/src/interactive-auth";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import InteractiveAuth, {
    ERROR_USER_CANCELLED,
    type InteractiveAuthCallback,
    type InteractiveAuthProps,
} from "../../structures/InteractiveAuth";
import { type ContinueKind, SSOAuthEntry } from "../auth/InteractiveAuthEntryComponents";
import BaseDialog from "./BaseDialog";
import { Linkify } from "../../../Linkify";

type DialogAesthetics = Partial<{
    [x in AuthType]: {
        [x: number]: {
            title: string;
            body: string;
            continueText: string;
            continueKind: ContinueKind;
        };
    };
}>;

export interface InteractiveAuthDialogProps<T = unknown>
    extends Pick<InteractiveAuthProps<T>, "makeRequest" | "authData"> {
    // matrix client to use for UI auth requests
    matrixClient: MatrixClient;

    // Optional title and body to show when not showing a particular stage
    title?: string;
    body?: string;

    // Optional title and body pairs for particular stages and phases within
    // those stages. Object structure/example is:
    // {
    //     "org.example.stage_type": {
    //         1: {
    //             "body": "This is a body for phase 1" of org.example.stage_type,
    //             "title": "Title for phase 1 of org.example.stage_type"
    //         },
    //         2: {
    //             "body": "This is a body for phase 2 of org.example.stage_type",
    //             "title": "Title for phase 2 of org.example.stage_type"
    //             "continueText": "Confirm identity with Example Auth",
    //             "continueKind": "danger"
    //         }
    //     }
    // }
    //
    // Default is defined in _getDefaultDialogAesthetics()
    aestheticsForStagePhases?: DialogAesthetics;

    onFinished(success?: boolean, result?: T | Error | null): void;
}

interface IState {
    authError: Error | null;

    // See _onUpdateStagePhase()
    uiaStage: AuthType | null;
    uiaStagePhase: number | null;
}

export default class InteractiveAuthDialog<T> extends React.Component<InteractiveAuthDialogProps<T>, IState> {
    public constructor(props: InteractiveAuthDialogProps<T>) {
        super(props);

        this.state = {
            authError: null,

            // See _onUpdateStagePhase()
            uiaStage: null,
            uiaStagePhase: null,
        };
    }

    private getDefaultDialogAesthetics(): DialogAesthetics {
        const ssoAesthetics = {
            [SSOAuthEntry.PHASE_PREAUTH]: {
                title: _t("auth|uia|sso_title"),
                body: _t("auth|uia|sso_preauth_body"),
                continueText: _t("auth|sso"),
                continueKind: "primary",
            },
            [SSOAuthEntry.PHASE_POSTAUTH]: {
                title: _t("auth|uia|sso_postauth_title"),
                body: _t("auth|uia|sso_postauth_body"),
                continueText: _t("action|confirm"),
                continueKind: "primary",
            },
        };

        return {
            [SSOAuthEntry.LOGIN_TYPE]: ssoAesthetics,
            [SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: ssoAesthetics,
        };
    }

    private onAuthFinished: InteractiveAuthCallback<T> = async (success, result): Promise<void> => {
        if (success) {
            this.props.onFinished(true, result as T);
        } else {
            if (result === ERROR_USER_CANCELLED) {
                this.props.onFinished(false, null);
            } else {
                this.setState({
                    authError: result as Error,
                });
            }
        }
    };

    private onUpdateStagePhase = (newStage: AuthType, newPhase: number): void => {
        // We copy the stage and stage phase params into state for title selection in render()
        this.setState({ uiaStage: newStage, uiaStagePhase: newPhase });
    };

    private onDismissClick = (): void => {
        this.props.onFinished(false);
    };

    public render(): React.ReactNode {
        // Let's pick a title, body, and other params text that we'll show to the user. The order
        // is most specific first, so stagePhase > our props > defaults.

        let title = this.state.authError ? "Error" : this.props.title || _t("common|authentication");
        let body = this.state.authError ? null : this.props.body;
        let continueText: string | undefined;
        let continueKind: ContinueKind | undefined;
        const dialogAesthetics = this.props.aestheticsForStagePhases || this.getDefaultDialogAesthetics();
        if (!this.state.authError && dialogAesthetics) {
            if (
                this.state.uiaStage !== null &&
                this.state.uiaStagePhase !== null &&
                dialogAesthetics[this.state.uiaStage]
            ) {
                const aesthetics = dialogAesthetics[this.state.uiaStage]![this.state.uiaStagePhase];
                if (aesthetics) {
                    if (aesthetics.title) title = aesthetics.title;
                    if (aesthetics.body) body = aesthetics.body;
                    if (aesthetics.continueText) continueText = aesthetics.continueText;
                    if (aesthetics.continueKind) continueKind = aesthetics.continueKind;
                }
            }
        }

        let content: JSX.Element;
        if (this.state.authError) {
            content = (
                <div id="mx_Dialog_content">
                    <Linkify>
                        <div role="alert">{this.state.authError.message || this.state.authError.toString()}</div>
                    </Linkify>
                    <br />
                    <AccessibleButton onClick={this.onDismissClick} className="mx_GeneralButton" autoFocus={true}>
                        {_t("action|dismiss")}
                    </AccessibleButton>
                </div>
            );
        } else {
            content = (
                <div id="mx_Dialog_content">
                    {body}
                    <InteractiveAuth
                        matrixClient={this.props.matrixClient}
                        authData={this.props.authData}
                        makeRequest={this.props.makeRequest}
                        onAuthFinished={this.onAuthFinished}
                        onStagePhaseChange={this.onUpdateStagePhase}
                        continueText={continueText}
                        continueKind={continueKind}
                    />
                </div>
            );
        }

        return (
            <BaseDialog
                className="mx_InteractiveAuthDialog"
                onFinished={this.props.onFinished}
                title={title}
                contentId="mx_Dialog_content"
            >
                {content}
            </BaseDialog>
        );
    }
}
