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

import React, {useCallback, useEffect, useState} from 'react';

import EncryptionInfo from "./EncryptionInfo";
import VerificationPanel from "./VerificationPanel";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {ensureDMExists} from "../../../createRoom";
import {useEventEmitter} from "../../../hooks/useEventEmitter";

const EncryptionPanel = ({verificationRequest, member}) => {
    const [request, setRequest] = useState(verificationRequest);
    useEffect(() => {
        setRequest(verificationRequest);
    }, [verificationRequest]);

    const [pending, setPending] = useState(false);
    const changeHandler = useCallback(() => {
        setPending(request && request.requested);
    }, [request]);
    useEventEmitter(request, "change", changeHandler);
    useEffect(changeHandler, [changeHandler]);

    const onStartVerification = useCallback(async () => {
        const cli = MatrixClientPeg.get();
        const roomId = await ensureDMExists(cli, member.userId);
        const verificationRequest = await cli.requestVerificationDM(member.userId, roomId);
        setRequest(verificationRequest);
    }, [member.userId]);

    if (!request || pending) {
        return <EncryptionInfo onStartVerification={onStartVerification} member={member} pending={pending} />;
    } else {
        return <VerificationPanel member={member} request={request} key={request.channel.transactionId} />;
    }
};
EncryptionPanel.propTypes = {

};

export default EncryptionPanel;
