/*
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

import {
    OlmMachine,
    KeysBackupRequest,
    KeysClaimRequest,
    KeysQueryRequest,
    KeysUploadRequest,
    RoomMessageRequest,
    SignatureUploadRequest,
    ToDeviceRequest,
    SigningKeysUploadRequest,
} from "@matrix-org/matrix-sdk-crypto-js";

import { logger } from "../logger";
import { IHttpOpts, MatrixHttpApi, Method } from "../http-api";
import { QueryDict } from "../utils";
import { IAuthDict, UIAuthCallback } from "../interactive-auth";
import { UIAResponse } from "../@types/uia";

/**
 * Common interface for all the request types returned by `OlmMachine.outgoingRequests`.
 */
export interface OutgoingRequest {
    readonly id: string | undefined;
    readonly type: number;
}

/**
 * OutgoingRequestManager: turns `OutgoingRequest`s from the rust sdk into HTTP requests
 *
 * We have one of these per `RustCrypto` (and hence per `MatrixClient`), not that it does anything terribly complicated.
 * It's responsible for:
 *
 *   * holding the reference to the `MatrixHttpApi`
 *   * turning `OutgoingRequest`s from the rust backend into HTTP requests, and sending them
 *   * sending the results of such requests back to the rust backend.
 */
export class OutgoingRequestProcessor {
    public constructor(
        private readonly olmMachine: OlmMachine,
        private readonly http: MatrixHttpApi<IHttpOpts & { onlyData: true }>,
    ) {}

    public async makeOutgoingRequest<T>(msg: OutgoingRequest, uiaCallback?: UIAuthCallback<T>): Promise<void> {
        let resp: string;

        /* refer https://docs.rs/matrix-sdk-crypto/0.6.0/matrix_sdk_crypto/requests/enum.OutgoingRequests.html
         * for the complete list of request types
         */
        if (msg instanceof KeysUploadRequest) {
            resp = await this.rawJsonRequest(Method.Post, "/_matrix/client/v3/keys/upload", {}, msg.body);
        } else if (msg instanceof KeysQueryRequest) {
            resp = await this.rawJsonRequest(Method.Post, "/_matrix/client/v3/keys/query", {}, msg.body);
        } else if (msg instanceof KeysClaimRequest) {
            resp = await this.rawJsonRequest(Method.Post, "/_matrix/client/v3/keys/claim", {}, msg.body);
        } else if (msg instanceof SignatureUploadRequest) {
            resp = await this.rawJsonRequest(Method.Post, "/_matrix/client/v3/keys/signatures/upload", {}, msg.body);
        } else if (msg instanceof KeysBackupRequest) {
            resp = await this.rawJsonRequest(Method.Put, "/_matrix/client/v3/room_keys/keys", {}, msg.body);
        } else if (msg instanceof ToDeviceRequest) {
            const path =
                `/_matrix/client/v3/sendToDevice/${encodeURIComponent(msg.event_type)}/` +
                encodeURIComponent(msg.txn_id);
            resp = await this.rawJsonRequest(Method.Put, path, {}, msg.body);
        } else if (msg instanceof RoomMessageRequest) {
            const path =
                `/_matrix/client/v3/room/${encodeURIComponent(msg.room_id)}/send/` +
                `${encodeURIComponent(msg.event_type)}/${encodeURIComponent(msg.txn_id)}`;
            resp = await this.rawJsonRequest(Method.Put, path, {}, msg.body);
        } else if (msg instanceof SigningKeysUploadRequest) {
            resp = await this.makeRequestWithUIA(
                Method.Post,
                "/_matrix/client/v3/keys/device_signing/upload",
                {},
                msg.body,
                uiaCallback,
            );
        } else {
            logger.warn("Unsupported outgoing message", Object.getPrototypeOf(msg));
            resp = "";
        }

        if (msg.id) {
            await this.olmMachine.markRequestAsSent(msg.id, msg.type, resp);
        }
    }

    private async makeRequestWithUIA<T>(
        method: Method,
        path: string,
        queryParams: QueryDict,
        body: string,
        uiaCallback: UIAuthCallback<T> | undefined,
    ): Promise<string> {
        if (!uiaCallback) {
            return await this.rawJsonRequest(method, path, queryParams, body);
        }

        const parsedBody = JSON.parse(body);
        const makeRequest = async (auth: IAuthDict): Promise<UIAResponse<T>> => {
            const newBody = {
                ...parsedBody,
                auth,
            };
            const resp = await this.rawJsonRequest(method, path, queryParams, JSON.stringify(newBody));
            return JSON.parse(resp) as T;
        };

        const resp = await uiaCallback(makeRequest);
        return JSON.stringify(resp);
    }

    private async rawJsonRequest(method: Method, path: string, queryParams: QueryDict, body: string): Promise<string> {
        const opts = {
            // inhibit the JSON stringification and parsing within HttpApi.
            json: false,

            // nevertheless, we are sending, and accept, JSON.
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },

            // we use the full prefix
            prefix: "",
        };

        try {
            const response = await this.http.authedRequest<string>(method, path, queryParams, body, opts);
            logger.info(`rust-crypto: successfully made HTTP request: ${method} ${path}`);
            return response;
        } catch (e) {
            logger.warn(`rust-crypto: error making HTTP request: ${method} ${path}: ${e}`);
            throw e;
        }
    }
}
