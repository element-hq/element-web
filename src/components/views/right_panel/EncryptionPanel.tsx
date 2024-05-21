/*
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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { VerificationPhase, VerificationRequest, VerificationRequestEvent } from "matrix-js-sdk/src/crypto-api";
import { RoomMember, User } from "matrix-js-sdk/src/matrix";

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
    const [phase, setPhase] = useState(request?.phase);
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
                headerImage: require("../../../../res/img/e2e/warning-deprecated.svg").default,
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
                headerImage: require("../../../../res/img/e2e/warning.svg").default,
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
