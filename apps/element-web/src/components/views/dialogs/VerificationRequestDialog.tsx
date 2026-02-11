/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { VerificationPhase, VerificationRequestEvent, type VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import { VerificationMethod } from "matrix-js-sdk/src/types";
import { type User } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import EncryptionPanel from "../right_panel/EncryptionPanel";

interface IProps {
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    onFinished: () => void;
    member?: User;
}

interface IState {
    // The VerificationRequest that is ongoing. This can be replaced if a
    // promise was supplied in the props and it completes.
    verificationRequest?: VerificationRequest;

    // What phase the VerificationRequest is at. This is part of
    // verificationRequest but we have it as independent state because we need
    // to update when it changes.
    //
    // We listen to the `Change` event on verificationRequest and update phase
    // when that fires.
    phase?: VerificationPhase;
}

export default class VerificationRequestDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            verificationRequest: this.props.verificationRequest,
            phase: this.props.verificationRequest?.phase,
        };
    }

    public componentDidMount(): void {
        // Listen to when the verificationRequest changes, so we can keep our
        // phase up-to-date.
        this.state.verificationRequest?.on(VerificationRequestEvent.Change, this.onRequestChange);

        this.props.verificationRequestPromise?.then((r) => {
            // The request promise completed, so we have a new request

            // Stop listening to the old request (if we have one, which normally we won't)
            this.state.verificationRequest?.off(VerificationRequestEvent.Change, this.onRequestChange);

            // And start listening to the new one
            r.on(VerificationRequestEvent.Change, this.onRequestChange);

            this.setState({ verificationRequest: r, phase: r.phase });
        });
    }

    public componentWillUnmount(): void {
        // Stop listening for changes to the request when we close
        this.state.verificationRequest?.off(VerificationRequestEvent.Change, this.onRequestChange);
    }

    /**
     * The verificationRequest changed, so we need to make sure we update our
     * state to have the correct phase.
     *
     * Note: this is called when verificationRequest changes in some way, not
     * when we replace verificationRequest with some new request.
     */
    private readonly onRequestChange = (): void => {
        this.setState((prevState) => ({
            phase: prevState.verificationRequest?.phase,
        }));
    };

    public render(): React.ReactNode {
        const request = this.state.verificationRequest;
        const otherUserId = request?.otherUserId;
        const member = this.props.member || (otherUserId ? MatrixClientPeg.safeGet().getUser(otherUserId) : null);
        const title = this.dialogTitle(request);

        if (!member) return null;

        return (
            <BaseDialog
                className="mx_InfoDialog"
                onFinished={this.props.onFinished}
                contentId="mx_Dialog_content"
                title={title}
                hasCancel={true}
            >
                <EncryptionPanel
                    layout="dialog"
                    verificationRequest={this.state.verificationRequest}
                    verificationRequestPromise={this.props.verificationRequestPromise}
                    onClose={this.props.onFinished}
                    member={member}
                    isRoomEncrypted={false}
                />
            </BaseDialog>
        );
    }

    private dialogTitle(request?: VerificationRequest): string {
        if (request?.isSelfVerification) {
            switch (request.phase) {
                case VerificationPhase.Ready:
                    return _t("encryption|verification|verification_dialog_title_choose");
                case VerificationPhase.Done:
                    return _t("encryption|verification|verification_dialog_title_verified");
                case VerificationPhase.Started:
                    switch (request.chosenMethod) {
                        case VerificationMethod.Reciprocate:
                            return _t("encryption|verification|verification_dialog_title_confirm_green_shield");
                        case VerificationMethod.Sas:
                            return _t("encryption|verification|verification_dialog_title_compare_emojis");
                        default:
                            return _t("encryption|verification|verification_dialog_title_device");
                    }
                case VerificationPhase.Unsent:
                case VerificationPhase.Requested:
                    return _t("encryption|verification|verification_dialog_title_start_on_other_device");
                case VerificationPhase.Cancelled:
                    return _t("encryption|verification|verification_dialog_title_failed");
                default:
                    return _t("encryption|verification|verification_dialog_title_device");
            }
        } else {
            return _t("encryption|verification|verification_dialog_title_user");
        }
    }
}
