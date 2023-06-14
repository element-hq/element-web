/*
Copyright 2019 New Vector Ltd

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

import React, { ReactNode } from "react";
import { GeneratedSas, ShowSasCallbacks, Verifier, VerifierEvent } from "matrix-js-sdk/src/crypto-api/verification";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import { mediaFromMxc } from "../../../customisations/Media";
import VerificationComplete from "../verification/VerificationComplete";
import VerificationCancelled from "../verification/VerificationCancelled";
import BaseAvatar from "../avatars/BaseAvatar";
import Spinner from "../elements/Spinner";
import VerificationShowSas from "../verification/VerificationShowSas";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

const PHASE_START = 0;
const PHASE_SHOW_SAS = 1;
const PHASE_WAIT_FOR_PARTNER_TO_CONFIRM = 2;
const PHASE_VERIFIED = 3;
const PHASE_CANCELLED = 4;

interface IProps {
    verifier: Verifier;
    onFinished(verified?: boolean): void;
}

interface IState {
    phase: number;
    sasVerified: boolean;
    opponentProfile: {
        // eslint-disable-next-line camelcase
        avatar_url?: string;
        displayname?: string;
    } | null;
    opponentProfileError: Error | null;
    sas: GeneratedSas | null;
}

export default class IncomingSasDialog extends React.Component<IProps, IState> {
    private showSasEvent: ShowSasCallbacks | null;

    public constructor(props: IProps) {
        super(props);

        let phase = PHASE_START;
        if (this.props.verifier.hasBeenCancelled) {
            logger.log("Verifier was cancelled in the background.");
            phase = PHASE_CANCELLED;
        }

        this.showSasEvent = null;
        this.state = {
            phase: phase,
            sasVerified: false,
            opponentProfile: null,
            opponentProfileError: null,
            sas: null,
        };
        this.props.verifier.on(VerifierEvent.ShowSas, this.onVerifierShowSas);
        this.props.verifier.on(VerifierEvent.Cancel, this.onVerifierCancel);
        this.fetchOpponentProfile();
    }

    public componentWillUnmount(): void {
        if (this.state.phase !== PHASE_CANCELLED && this.state.phase !== PHASE_VERIFIED) {
            this.props.verifier.cancel(new Error("User cancel"));
        }
        this.props.verifier.removeListener(VerifierEvent.ShowSas, this.onVerifierShowSas);
    }

    private async fetchOpponentProfile(): Promise<void> {
        try {
            const prof = await MatrixClientPeg.get().getProfileInfo(this.props.verifier.userId);
            this.setState({
                opponentProfile: prof,
            });
        } catch (e) {
            this.setState({
                opponentProfileError: e as Error,
            });
        }
    }

    private onFinished = (): void => {
        this.props.onFinished(this.state.phase === PHASE_VERIFIED);
    };

    private onCancelClick = (): void => {
        this.props.onFinished(this.state.phase === PHASE_VERIFIED);
    };

    private onContinueClick = (): void => {
        this.setState({ phase: PHASE_WAIT_FOR_PARTNER_TO_CONFIRM });
        this.props.verifier
            .verify()
            .then(() => {
                this.setState({ phase: PHASE_VERIFIED });
            })
            .catch((e) => {
                logger.log("Verification failed", e);
            });
    };

    private onVerifierShowSas = (e: ShowSasCallbacks): void => {
        this.showSasEvent = e;
        this.setState({
            phase: PHASE_SHOW_SAS,
            sas: e.sas,
        });
    };

    private onVerifierCancel = (): void => {
        this.setState({
            phase: PHASE_CANCELLED,
        });
    };

    private onSasMatchesClick = (): void => {
        this.showSasEvent?.confirm();
        this.setState({
            phase: PHASE_WAIT_FOR_PARTNER_TO_CONFIRM,
        });
    };

    private onVerifiedDoneClick = (): void => {
        this.props.onFinished(true);
    };

    private renderPhaseStart(): ReactNode {
        const isSelf = this.props.verifier.userId === MatrixClientPeg.get().getUserId();

        let profile;
        const oppProfile = this.state.opponentProfile;
        if (oppProfile) {
            const url = oppProfile.avatar_url ? mediaFromMxc(oppProfile.avatar_url).getSquareThumbnailHttp(48) : null;
            profile = (
                <div className="mx_IncomingSasDialog_opponentProfile">
                    <BaseAvatar
                        name={oppProfile.displayname}
                        idName={this.props.verifier.userId}
                        url={url}
                        width={48}
                        height={48}
                        resizeMethod="crop"
                    />
                    <h2>{oppProfile.displayname}</h2>
                </div>
            );
        } else if (this.state.opponentProfileError) {
            profile = (
                <div>
                    <BaseAvatar
                        name={this.props.verifier.userId.slice(1)}
                        idName={this.props.verifier.userId}
                        width={48}
                        height={48}
                    />
                    <h2>{this.props.verifier.userId}</h2>
                </div>
            );
        } else {
            profile = <Spinner />;
        }

        const userDetailText = [
            <p key="p1">
                {_t(
                    "Verify this user to mark them as trusted. " +
                        "Trusting users gives you extra peace of mind when using " +
                        "end-to-end encrypted messages.",
                )}
            </p>,
            <p key="p2">
                {_t(
                    // NB. Below wording adjusted to singular 'session' until we have
                    // cross-signing
                    "Verifying this user will mark their session as trusted, and " +
                        "also mark your session as trusted to them.",
                )}
            </p>,
        ];

        const selfDetailText = [
            <p key="p1">
                {_t(
                    "Verify this device to mark it as trusted. " +
                        "Trusting this device gives you and other users extra peace of mind when using " +
                        "end-to-end encrypted messages.",
                )}
            </p>,
            <p key="p2">
                {_t(
                    "Verifying this device will mark it as trusted, and users who have verified with " +
                        "you will trust this device.",
                )}
            </p>,
        ];

        return (
            <div>
                {profile}
                {isSelf ? selfDetailText : userDetailText}
                <DialogButtons
                    primaryButton={_t("Continue")}
                    hasCancel={true}
                    onPrimaryButtonClick={this.onContinueClick}
                    onCancel={this.onCancelClick}
                />
            </div>
        );
    }

    private renderPhaseShowSas(): ReactNode {
        if (!this.showSasEvent) return null;
        return (
            <VerificationShowSas
                sas={this.showSasEvent.sas}
                onCancel={this.onCancelClick}
                onDone={this.onSasMatchesClick}
                isSelf={this.props.verifier.userId === MatrixClientPeg.get().getUserId()}
                inDialog={true}
            />
        );
    }

    private renderPhaseWaitForPartnerToConfirm(): ReactNode {
        return (
            <div>
                <Spinner />
                <p>{_t("Waiting for partner to confirm…")}</p>
            </div>
        );
    }

    private renderPhaseVerified(): ReactNode {
        return <VerificationComplete onDone={this.onVerifiedDoneClick} />;
    }

    private renderPhaseCancelled(): ReactNode {
        return <VerificationCancelled onDone={this.onCancelClick} />;
    }

    public render(): ReactNode {
        let body;
        switch (this.state.phase) {
            case PHASE_START:
                body = this.renderPhaseStart();
                break;
            case PHASE_SHOW_SAS:
                body = this.renderPhaseShowSas();
                break;
            case PHASE_WAIT_FOR_PARTNER_TO_CONFIRM:
                body = this.renderPhaseWaitForPartnerToConfirm();
                break;
            case PHASE_VERIFIED:
                body = this.renderPhaseVerified();
                break;
            case PHASE_CANCELLED:
                body = this.renderPhaseCancelled();
                break;
        }

        return (
            <BaseDialog title={_t("Incoming Verification Request")} onFinished={this.onFinished} fixedWidth={false}>
                {body}
            </BaseDialog>
        );
    }
}
