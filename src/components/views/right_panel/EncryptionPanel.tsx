/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useRef, useState } from "react";
import { VerificationPhase, type VerificationRequest, VerificationRequestEvent } from "matrix-js-sdk/src/crypto-api";
import { type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import EncryptionInfo from "./EncryptionInfo";
import VerificationPanel from "./VerificationPanel";
import { ensureDMExists } from "../../../createRoom";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import ErrorDialog from "../dialogs/ErrorDialog";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import WarningDeprecatedSvg from "../../../../res/img/e2e/warning-deprecated.svg";
import WarningSvg from "../../../../res/img/e2e/warning.svg";

// cancellation codes which constitute a key mismatch
const MISMATCHES = ["m.key_mismatch", "m.user_error", "m.mismatched_sas"];

interface IProps {
    member: RoomMember | User;
    onClose: () => void;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
    layout: string;
    isRoomEncrypted: boolean;
}

const EncryptionPanel: React.FC<IProps> = (props: IProps) => {
    const cli = useMatrixClientContext();
    const { verificationRequest, verificationRequestPromise, member, onClose, layout, isRoomEncrypted } = props;
    const [request, setRequest] = useState(verificationRequest);
    // state to show a spinner immediately after clicking "start verification",
    // before we have a request
    const [isRequesting, setRequesting] = useState(false);
    const [phase, doSetPhase] = useState(request?.phase);
    const setPhase = (phase: VerificationPhase | undefined): void => {
        logger.debug(`EncryptionPanel: phase now ${phase === undefined ? phase : VerificationPhase[phase]}`);
        doSetPhase(phase);
    };

    useEffect(() => {
        setRequest(verificationRequest);
        if (verificationRequest) {
            setRequesting(false);
            setPhase(verificationRequest.phase);
        }
    }, [verificationRequest]);

    useEffect(() => {
        async function awaitPromise(): Promise<void> {
            setRequesting(true);
            const requestFromPromise = await verificationRequestPromise;
            setRequesting(false);
            setRequest(requestFromPromise);
            setPhase(requestFromPromise?.phase);
        }
        if (verificationRequestPromise) {
            awaitPromise();
        }
    }, [verificationRequestPromise]);
    // Use a ref to track whether we are already showing the mismatch modal as state may not update fast enough
    // if two change events are fired in quick succession like can happen with rust crypto.
    const isShowingMismatchModal = useRef(false);
    const changeHandler = useCallback(() => {
        // handle transitions -> cancelled for mismatches which fire a modal instead of showing a card
        if (
            !isShowingMismatchModal.current &&
            request?.phase === VerificationPhase.Cancelled &&
            MISMATCHES.includes(request.cancellationCode ?? "")
        ) {
            isShowingMismatchModal.current = true;
            Modal.createDialog(ErrorDialog, {
                headerImage: WarningDeprecatedSvg,
                title: _t("encryption|messages_not_secure|title"),
                description: (
                    <div>
                        {_t("encryption|messages_not_secure|heading")}
                        <ul>
                            <li>{_t("encryption|messages_not_secure|cause_1")}</li>
                            <li>{_t("encryption|messages_not_secure|cause_2")}</li>
                            <li>{_t("encryption|messages_not_secure|cause_3")}</li>
                            <li>{_t("encryption|messages_not_secure|cause_4")}</li>
                        </ul>
                    </div>
                ),
                onFinished: onClose,
            });
            return; // don't update phase here as we will be transitioning away from this view shortly
        }

        if (request) {
            setPhase(request.phase);
        }
    }, [onClose, request]);

    useTypedEventEmitter(request, VerificationRequestEvent.Change, changeHandler);

    const onStartVerification = useCallback(async (): Promise<void> => {
        setRequesting(true);
        let verificationRequest_: VerificationRequest;
        try {
            const roomId = await ensureDMExists(cli, member.userId);
            if (!roomId) {
                throw new Error("Unable to create Room for verification");
            }
            verificationRequest_ = await cli.getCrypto()!.requestVerificationDM(member.userId, roomId);
        } catch (e) {
            console.error("Error starting verification", e);
            setRequesting(false);

            Modal.createDialog(ErrorDialog, {
                headerImage: WarningSvg,
                title: _t("encryption|verification|error_starting_title"),
                description: _t("encryption|verification|error_starting_description"),
            });
            return;
        }
        setRequest(verificationRequest_);
        setPhase(verificationRequest_.phase);
        // Notify the RightPanelStore about this
        if (RightPanelStore.instance.currentCard.phase != RightPanelPhases.EncryptionPanel) {
            RightPanelStore.instance.pushCard({
                phase: RightPanelPhases.EncryptionPanel,
                state: { member, verificationRequest: verificationRequest_ },
            });
        }
        if (!RightPanelStore.instance.isOpen) RightPanelStore.instance.togglePanel(null);
    }, [cli, member]);

    const requested: boolean =
        (!request && isRequesting) ||
        (!!request &&
            (phase === VerificationPhase.Requested || phase === VerificationPhase.Unsent || phase === undefined));
    const isSelfVerification = request ? request.isSelfVerification : member.userId === cli.getUserId();

    if (!request || requested) {
        const initiatedByMe = (!request && isRequesting) || (!!request && request.initiatedByMe);
        return (
            <EncryptionInfo
                isRoomEncrypted={isRoomEncrypted}
                onStartVerification={onStartVerification}
                member={member}
                isSelfVerification={isSelfVerification}
                waitingForOtherParty={requested && initiatedByMe}
                waitingForNetwork={requested && !initiatedByMe}
                inDialog={layout === "dialog"}
            />
        );
    } else {
        return (
            <VerificationPanel
                isRoomEncrypted={isRoomEncrypted}
                layout={layout}
                onClose={onClose}
                member={member}
                request={request}
                key={request.transactionId}
                inDialog={layout === "dialog"}
                phase={phase}
            />
        );
    }
};

export default EncryptionPanel;
