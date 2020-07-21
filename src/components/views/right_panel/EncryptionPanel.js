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

import React, {useCallback, useEffect, useState} from "react";
import PropTypes from "prop-types";

import EncryptionInfo from "./EncryptionInfo";
import VerificationPanel from "./VerificationPanel";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {ensureDMExists} from "../../../createRoom";
import {useEventEmitter} from "../../../hooks/useEventEmitter";
import Modal from "../../../Modal";
import {PHASE_REQUESTED, PHASE_UNSENT} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import * as sdk from "../../../index";
import {_t} from "../../../languageHandler";

// cancellation codes which constitute a key mismatch
const MISMATCHES = ["m.key_mismatch", "m.user_error", "m.mismatched_sas"];

const EncryptionPanel = (props) => {
    const {verificationRequest, verificationRequestPromise, member, onClose, layout, isRoomEncrypted} = props;
    const [request, setRequest] = useState(verificationRequest);
    // state to show a spinner immediately after clicking "start verification",
    // before we have a request
    const [isRequesting, setRequesting] = useState(false);
    const [phase, setPhase] = useState(request && request.phase);
    useEffect(() => {
        setRequest(verificationRequest);
        if (verificationRequest) {
            setRequesting(false);
            setPhase(verificationRequest.phase);
        }
    }, [verificationRequest]);

    useEffect(() => {
        async function awaitPromise() {
            setRequesting(true);
            const request = await verificationRequestPromise;
            setRequesting(false);
            setRequest(request);
            setPhase(request.phase);
        }
        if (verificationRequestPromise) {
            awaitPromise();
        }
    }, [verificationRequestPromise]);
    const changeHandler = useCallback(() => {
        // handle transitions -> cancelled for mismatches which fire a modal instead of showing a card
        if (request && request.cancelled && MISMATCHES.includes(request.cancellationCode)) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog("Verification failed", "insecure", ErrorDialog, {
                headerImage: require("../../../../res/img/e2e/warning.svg"),
                title: _t("Your messages are not secure"),
                description: <div>
                    {_t("One of the following may be compromised:")}
                    <ul>
                        <li>{_t("Your homeserver")}</li>
                        <li>{_t("The homeserver the user you’re verifying is connected to")}</li>
                        <li>{_t("Yours, or the other users’ internet connection")}</li>
                        <li>{_t("Yours, or the other users’ session")}</li>
                    </ul>
                </div>,
                onFinished: onClose,
            });
            return; // don't update phase here as we will be transitioning away from this view shortly
        }

        if (request) {
            setPhase(request.phase);
        }
    }, [onClose, request]);
    useEventEmitter(request, "change", changeHandler);

    const onCancel = useCallback(function() {
        if (request) {
            request.cancel();
        }
    }, [request]);

    let cancelButton;
    if (layout !== "dialog" && request && request.pending) {
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
        cancelButton = (<AccessibleButton
            className="mx_EncryptionPanel_cancel"
            onClick={onCancel}
            title={_t('Cancel')}
        ></AccessibleButton>);
    }

    const onStartVerification = useCallback(async () => {
        setRequesting(true);
        const cli = MatrixClientPeg.get();
        const roomId = await ensureDMExists(cli, member.userId);
        const verificationRequest = await cli.requestVerificationDM(member.userId, roomId);
        setRequest(verificationRequest);
        setPhase(verificationRequest.phase);
    }, [member.userId]);

    const requested =
        (!request && isRequesting) ||
        (request && (phase === PHASE_REQUESTED || phase === PHASE_UNSENT || phase === undefined));
    const isSelfVerification = request ?
        request.isSelfVerification :
        member.userId === MatrixClientPeg.get().getUserId();
    if (!request || requested) {
        const initiatedByMe = (!request && isRequesting) || (request && request.initiatedByMe);
        return (<React.Fragment>
            {cancelButton}
            <EncryptionInfo
                isRoomEncrypted={isRoomEncrypted}
                onStartVerification={onStartVerification}
                member={member}
                isSelfVerification={isSelfVerification}
                waitingForOtherParty={requested && initiatedByMe}
                waitingForNetwork={requested && !initiatedByMe}
                inDialog={layout === "dialog"} />
        </React.Fragment>);
    } else {
        return (<React.Fragment>
            {cancelButton}
            <VerificationPanel
                isRoomEncrypted={isRoomEncrypted}
                layout={layout}
                onClose={onClose}
                member={member}
                request={request}
                key={request.channel.transactionId}
                inDialog={layout === "dialog"}
                phase={phase}
            />
        </React.Fragment>);
    }
};
EncryptionPanel.propTypes = {
    member: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    verificationRequest: PropTypes.object,
    layout: PropTypes.string,
    inDialog: PropTypes.bool,
};

export default EncryptionPanel;
