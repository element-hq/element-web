/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { useContext, useEffect, useState } from "react";
import {
    VerificationPhase as Phase,
    VerificationRequest,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto-api";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";

import { useTypedEventEmitter, useTypedEventEmitterState } from "../../../../hooks/useEventEmitter";
import { _t, _td, TranslationKey } from "../../../../languageHandler";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import { Tool } from "../DevtoolsDialog";

const PHASE_MAP: Record<Phase, TranslationKey> = {
    [Phase.Unsent]: _td("common|unsent"),
    [Phase.Requested]: _td("devtools|phase_requested"),
    [Phase.Ready]: _td("devtools|phase_ready"),
    [Phase.Done]: _td("action|done"),
    [Phase.Started]: _td("devtools|phase_started"),
    [Phase.Cancelled]: _td("devtools|phase_cancelled"),
};

const VerificationRequestExplorer: React.FC<{
    txnId: string;
    request: VerificationRequest;
}> = ({ txnId, request }) => {
    const [, updateState] = useState();
    const [timeout, setRequestTimeout] = useState(request.timeout);

    /* Re-render if something changes state */
    useTypedEventEmitter(request, VerificationRequestEvent.Change, updateState);

    /* Keep re-rendering if there's a timeout */
    useEffect(() => {
        if (request.timeout == 0) return;

        /* Note that request.timeout is a getter, so its value changes */
        const id = window.setInterval(() => {
            setRequestTimeout(request.timeout);
        }, 500);

        return () => {
            clearInterval(id);
        };
    }, [request]);

    return (
        <div className="mx_DevTools_VerificationRequest">
            <dl>
                <dt>{_t("devtools|phase_transaction")}</dt>
                <dd>{txnId}</dd>
                <dt>{_t("devtools|phase")}</dt>
                <dd>{PHASE_MAP[request.phase] ? _t(PHASE_MAP[request.phase]) : request.phase}</dd>
                <dt>{_t("devtools|timeout")}</dt>
                <dd>{timeout === null ? _t("devtools|timeout_none") : Math.floor(timeout / 1000)}</dd>
                <dt>{_t("devtools|methods")}</dt>
                <dd>{request.methods && request.methods.join(", ")}</dd>
                <dt>{_t("devtools|other_user")}</dt>
                <dd>{request.otherUserId}</dd>
            </dl>
        </div>
    );
};

const VerificationExplorer: Tool = ({ onBack }: IDevtoolsProps) => {
    const cli = useContext(MatrixClientContext);
    const context = useContext(DevtoolsContext);

    const requests = useTypedEventEmitterState(cli, CryptoEvent.VerificationRequestReceived, () => {
        return (
            cli.crypto?.inRoomVerificationRequests["requestsByRoomId"]?.get(context.room.roomId) ??
            new Map<string, VerificationRequest>()
        );
    });

    return (
        <BaseTool onBack={onBack}>
            {Array.from(requests.entries())
                .reverse()
                .map(([txnId, request]) => (
                    <VerificationRequestExplorer txnId={txnId} request={request} key={txnId} />
                ))}
            {requests.size < 1 && _t("devtools|no_verification_requests_found")}
        </BaseTool>
    );
};

export default VerificationExplorer;
