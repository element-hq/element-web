/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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

import { v4 as uuidv4 } from "uuid";

import { logger } from "../logger";
import { MatrixClient } from "../client";
import { IRoomKeyRequestBody, IRoomKeyRequestRecipient } from "./index";
import { CryptoStore, OutgoingRoomKeyRequest } from "./store/base";
import { EventType, ToDeviceMessageId } from "../@types/event";
import { MapWithDefault } from "../utils";

/**
 * Internal module. Management of outgoing room key requests.
 *
 * See https://docs.google.com/document/d/1m4gQkcnJkxNuBmb5NoFCIadIY-DyqqNAS3lloE73BlQ
 * for draft documentation on what we're supposed to be implementing here.
 */

// delay between deciding we want some keys, and sending out the request, to
// allow for (a) it turning up anyway, (b) grouping requests together
const SEND_KEY_REQUESTS_DELAY_MS = 500;

/**
 *  possible states for a room key request
 *
 * The state machine looks like:
 * ```
 *
 *     |         (cancellation sent)
 *     | .-------------------------------------------------.
 *     | |                                                 |
 *     V V       (cancellation requested)                  |
 *   UNSENT  -----------------------------+                |
 *     |                                  |                |
 *     |                                  |                |
 *     | (send successful)                |  CANCELLATION_PENDING_AND_WILL_RESEND
 *     V                                  |                Λ
 *    SENT                                |                |
 *     |--------------------------------  |  --------------'
 *     |                                  |  (cancellation requested with intent
 *     |                                  |   to resend the original request)
 *     |                                  |
 *     | (cancellation requested)         |
 *     V                                  |
 * CANCELLATION_PENDING                   |
 *     |                                  |
 *     | (cancellation sent)              |
 *     V                                  |
 * (deleted)  <---------------------------+
 * ```
 */
export enum RoomKeyRequestState {
    /** request not yet sent */
    Unsent,
    /** request sent, awaiting reply */
    Sent,
    /** reply received, cancellation not yet sent */
    CancellationPending,
    /**
     * Cancellation not yet sent and will transition to UNSENT instead of
     * being deleted once the cancellation has been sent.
     */
    CancellationPendingAndWillResend,
}

interface RequestMessageBase {
    requesting_device_id: string;
    request_id: string;
}

interface RequestMessageRequest extends RequestMessageBase {
    action: "request";
    body: IRoomKeyRequestBody;
}

interface RequestMessageCancellation extends RequestMessageBase {
    action: "request_cancellation";
}

type RequestMessage = RequestMessageRequest | RequestMessageCancellation;

export class OutgoingRoomKeyRequestManager {
    // handle for the delayed call to sendOutgoingRoomKeyRequests. Non-null
    // if the callback has been set, or if it is still running.
    private sendOutgoingRoomKeyRequestsTimer?: ReturnType<typeof setTimeout>;

    // sanity check to ensure that we don't end up with two concurrent runs
    // of sendOutgoingRoomKeyRequests
    private sendOutgoingRoomKeyRequestsRunning = false;

    private clientRunning = true;

    public constructor(
        private readonly baseApis: MatrixClient,
        private readonly deviceId: string,
        private readonly cryptoStore: CryptoStore,
    ) {}

    /**
     * Called when the client is stopped. Stops any running background processes.
     */
    public stop(): void {
        logger.log("stopping OutgoingRoomKeyRequestManager");
        // stop the timer on the next run
        this.clientRunning = false;
    }

    /**
     * Send any requests that have been queued
     */
    public sendQueuedRequests(): void {
        this.startTimer();
    }

    /**
     * Queue up a room key request, if we haven't already queued or sent one.
     *
     * The `requestBody` is compared (with a deep-equality check) against
     * previous queued or sent requests and if it matches, no change is made.
     * Otherwise, a request is added to the pending list, and a job is started
     * in the background to send it.
     *
     * @param resend - whether to resend the key request if there is
     *    already one
     *
     * @returns resolves when the request has been added to the
     *    pending list (or we have established that a similar request already
     *    exists)
     */
    public async queueRoomKeyRequest(
        requestBody: IRoomKeyRequestBody,
        recipients: IRoomKeyRequestRecipient[],
        resend = false,
    ): Promise<void> {
        const req = await this.cryptoStore.getOutgoingRoomKeyRequest(requestBody);
        if (!req) {
            await this.cryptoStore.getOrAddOutgoingRoomKeyRequest({
                requestBody: requestBody,
                recipients: recipients,
                requestId: this.baseApis.makeTxnId(),
                state: RoomKeyRequestState.Unsent,
            });
        } else {
            switch (req.state) {
                case RoomKeyRequestState.CancellationPendingAndWillResend:
                case RoomKeyRequestState.Unsent:
                    // nothing to do here, since we're going to send a request anyways
                    return;

                case RoomKeyRequestState.CancellationPending: {
                    // existing request is about to be cancelled.  If we want to
                    // resend, then change the state so that it resends after
                    // cancelling.  Otherwise, just cancel the cancellation.
                    const state = resend
                        ? RoomKeyRequestState.CancellationPendingAndWillResend
                        : RoomKeyRequestState.Sent;
                    await this.cryptoStore.updateOutgoingRoomKeyRequest(
                        req.requestId,
                        RoomKeyRequestState.CancellationPending,
                        {
                            state,
                            cancellationTxnId: this.baseApis.makeTxnId(),
                        },
                    );
                    break;
                }
                case RoomKeyRequestState.Sent: {
                    // a request has already been sent.  If we don't want to
                    // resend, then do nothing.  If we do want to, then cancel the
                    // existing request and send a new one.
                    if (resend) {
                        const state = RoomKeyRequestState.CancellationPendingAndWillResend;
                        const updatedReq = await this.cryptoStore.updateOutgoingRoomKeyRequest(
                            req.requestId,
                            RoomKeyRequestState.Sent,
                            {
                                state,
                                cancellationTxnId: this.baseApis.makeTxnId(),
                                // need to use a new transaction ID so that
                                // the request gets sent
                                requestTxnId: this.baseApis.makeTxnId(),
                            },
                        );
                        if (!updatedReq) {
                            // updateOutgoingRoomKeyRequest couldn't find the request
                            // in state ROOM_KEY_REQUEST_STATES.SENT, so we must have
                            // raced with another tab to mark the request cancelled.
                            // Try again, to make sure the request is resent.
                            return this.queueRoomKeyRequest(requestBody, recipients, resend);
                        }

                        // We don't want to wait for the timer, so we send it
                        // immediately. (We might actually end up racing with the timer,
                        // but that's ok: even if we make the request twice, we'll do it
                        // with the same transaction_id, so only one message will get
                        // sent).
                        //
                        // (We also don't want to wait for the response from the server
                        // here, as it will slow down processing of received keys if we
                        // do.)
                        try {
                            await this.sendOutgoingRoomKeyRequestCancellation(updatedReq, true);
                        } catch (e) {
                            logger.error("Error sending room key request cancellation;" + " will retry later.", e);
                        }
                        // The request has transitioned from
                        // CANCELLATION_PENDING_AND_WILL_RESEND to UNSENT. We
                        // still need to resend the request which is now UNSENT, so
                        // start the timer if it isn't already started.
                    }
                    break;
                }
                default:
                    throw new Error("unhandled state: " + req.state);
            }
        }
    }

    /**
     * Cancel room key requests, if any match the given requestBody
     *
     *
     * @returns resolves when the request has been updated in our
     *    pending list.
     */
    public cancelRoomKeyRequest(requestBody: IRoomKeyRequestBody): Promise<unknown> {
        return this.cryptoStore.getOutgoingRoomKeyRequest(requestBody).then((req): unknown => {
            if (!req) {
                // no request was made for this key
                return;
            }
            switch (req.state) {
                case RoomKeyRequestState.CancellationPending:
                case RoomKeyRequestState.CancellationPendingAndWillResend:
                    // nothing to do here
                    return;

                case RoomKeyRequestState.Unsent:
                    // just delete it

                    // FIXME: ghahah we may have attempted to send it, and
                    // not yet got a successful response. So the server
                    // may have seen it, so we still need to send a cancellation
                    // in that case :/

                    logger.log("deleting unnecessary room key request for " + stringifyRequestBody(requestBody));
                    return this.cryptoStore.deleteOutgoingRoomKeyRequest(req.requestId, RoomKeyRequestState.Unsent);

                case RoomKeyRequestState.Sent: {
                    // send a cancellation.
                    return this.cryptoStore
                        .updateOutgoingRoomKeyRequest(req.requestId, RoomKeyRequestState.Sent, {
                            state: RoomKeyRequestState.CancellationPending,
                            cancellationTxnId: this.baseApis.makeTxnId(),
                        })
                        .then((updatedReq) => {
                            if (!updatedReq) {
                                // updateOutgoingRoomKeyRequest couldn't find the
                                // request in state ROOM_KEY_REQUEST_STATES.SENT,
                                // so we must have raced with another tab to mark
                                // the request cancelled. There is no point in
                                // sending another cancellation since the other tab
                                // will do it.
                                logger.log(
                                    "Tried to cancel room key request for " +
                                        stringifyRequestBody(requestBody) +
                                        " but it was already cancelled in another tab",
                                );
                                return;
                            }

                            // We don't want to wait for the timer, so we send it
                            // immediately. (We might actually end up racing with the timer,
                            // but that's ok: even if we make the request twice, we'll do it
                            // with the same transaction_id, so only one message will get
                            // sent).
                            //
                            // (We also don't want to wait for the response from the server
                            // here, as it will slow down processing of received keys if we
                            // do.)
                            this.sendOutgoingRoomKeyRequestCancellation(updatedReq).catch((e) => {
                                logger.error("Error sending room key request cancellation;" + " will retry later.", e);
                                this.startTimer();
                            });
                        });
                }
                default:
                    throw new Error("unhandled state: " + req.state);
            }
        });
    }

    /**
     * Look for room key requests by target device and state
     *
     * @param userId - Target user ID
     * @param deviceId - Target device ID
     *
     * @returns resolves to a list of all the {@link OutgoingRoomKeyRequest}
     */
    public getOutgoingSentRoomKeyRequest(userId: string, deviceId: string): Promise<OutgoingRoomKeyRequest[]> {
        return this.cryptoStore.getOutgoingRoomKeyRequestsByTarget(userId, deviceId, [RoomKeyRequestState.Sent]);
    }

    /**
     * Find anything in `sent` state, and kick it around the loop again.
     * This is intended for situations where something substantial has changed, and we
     * don't really expect the other end to even care about the cancellation.
     * For example, after initialization or self-verification.
     * @returns An array of `queueRoomKeyRequest` outputs.
     */
    public async cancelAndResendAllOutgoingRequests(): Promise<void[]> {
        const outgoings = await this.cryptoStore.getAllOutgoingRoomKeyRequestsByState(RoomKeyRequestState.Sent);
        return Promise.all(
            outgoings.map(({ requestBody, recipients }) => this.queueRoomKeyRequest(requestBody, recipients, true)),
        );
    }

    // start the background timer to send queued requests, if the timer isn't
    // already running
    private startTimer(): void {
        if (this.sendOutgoingRoomKeyRequestsTimer) {
            return;
        }

        const startSendingOutgoingRoomKeyRequests = (): void => {
            if (this.sendOutgoingRoomKeyRequestsRunning) {
                throw new Error("RoomKeyRequestSend already in progress!");
            }
            this.sendOutgoingRoomKeyRequestsRunning = true;

            this.sendOutgoingRoomKeyRequests()
                .finally(() => {
                    this.sendOutgoingRoomKeyRequestsRunning = false;
                })
                .catch((e) => {
                    // this should only happen if there is an indexeddb error,
                    // in which case we're a bit stuffed anyway.
                    logger.warn(`error in OutgoingRoomKeyRequestManager: ${e}`);
                });
        };

        this.sendOutgoingRoomKeyRequestsTimer = setTimeout(
            startSendingOutgoingRoomKeyRequests,
            SEND_KEY_REQUESTS_DELAY_MS,
        );
    }

    // look for and send any queued requests. Runs itself recursively until
    // there are no more requests, or there is an error (in which case, the
    // timer will be restarted before the promise resolves).
    private async sendOutgoingRoomKeyRequests(): Promise<void> {
        if (!this.clientRunning) {
            this.sendOutgoingRoomKeyRequestsTimer = undefined;
            return;
        }

        const req = await this.cryptoStore.getOutgoingRoomKeyRequestByState([
            RoomKeyRequestState.CancellationPending,
            RoomKeyRequestState.CancellationPendingAndWillResend,
            RoomKeyRequestState.Unsent,
        ]);

        if (!req) {
            this.sendOutgoingRoomKeyRequestsTimer = undefined;
            return;
        }

        try {
            switch (req.state) {
                case RoomKeyRequestState.Unsent:
                    await this.sendOutgoingRoomKeyRequest(req);
                    break;
                case RoomKeyRequestState.CancellationPending:
                    await this.sendOutgoingRoomKeyRequestCancellation(req);
                    break;
                case RoomKeyRequestState.CancellationPendingAndWillResend:
                    await this.sendOutgoingRoomKeyRequestCancellation(req, true);
                    break;
            }

            // go around the loop again
            return this.sendOutgoingRoomKeyRequests();
        } catch (e) {
            logger.error("Error sending room key request; will retry later.", e);
            this.sendOutgoingRoomKeyRequestsTimer = undefined;
        }
    }

    // given a RoomKeyRequest, send it and update the request record
    private sendOutgoingRoomKeyRequest(req: OutgoingRoomKeyRequest): Promise<unknown> {
        logger.log(
            `Requesting keys for ${stringifyRequestBody(req.requestBody)}` +
                ` from ${stringifyRecipientList(req.recipients)}` +
                `(id ${req.requestId})`,
        );

        const requestMessage: RequestMessage = {
            action: "request",
            requesting_device_id: this.deviceId,
            request_id: req.requestId,
            body: req.requestBody,
        };

        return this.sendMessageToDevices(requestMessage, req.recipients, req.requestTxnId || req.requestId).then(() => {
            return this.cryptoStore.updateOutgoingRoomKeyRequest(req.requestId, RoomKeyRequestState.Unsent, {
                state: RoomKeyRequestState.Sent,
            });
        });
    }

    // Given a RoomKeyRequest, cancel it and delete the request record unless
    // andResend is set, in which case transition to UNSENT.
    private sendOutgoingRoomKeyRequestCancellation(req: OutgoingRoomKeyRequest, andResend = false): Promise<unknown> {
        logger.log(
            `Sending cancellation for key request for ` +
                `${stringifyRequestBody(req.requestBody)} to ` +
                `${stringifyRecipientList(req.recipients)} ` +
                `(cancellation id ${req.cancellationTxnId})`,
        );

        const requestMessage: RequestMessage = {
            action: "request_cancellation",
            requesting_device_id: this.deviceId,
            request_id: req.requestId,
        };

        return this.sendMessageToDevices(requestMessage, req.recipients, req.cancellationTxnId).then(() => {
            if (andResend) {
                // We want to resend, so transition to UNSENT
                return this.cryptoStore.updateOutgoingRoomKeyRequest(
                    req.requestId,
                    RoomKeyRequestState.CancellationPendingAndWillResend,
                    { state: RoomKeyRequestState.Unsent },
                );
            }
            return this.cryptoStore.deleteOutgoingRoomKeyRequest(
                req.requestId,
                RoomKeyRequestState.CancellationPending,
            );
        });
    }

    // send a RoomKeyRequest to a list of recipients
    private sendMessageToDevices(
        message: RequestMessage,
        recipients: IRoomKeyRequestRecipient[],
        txnId?: string,
    ): Promise<{}> {
        const contentMap = new MapWithDefault<string, Map<string, Record<string, any>>>(() => new Map());
        for (const recip of recipients) {
            const userDeviceMap = contentMap.getOrCreate(recip.userId);
            userDeviceMap.set(recip.deviceId, {
                ...message,
                [ToDeviceMessageId]: uuidv4(),
            });
        }

        return this.baseApis.sendToDevice(EventType.RoomKeyRequest, contentMap, txnId);
    }
}

function stringifyRequestBody(requestBody: IRoomKeyRequestBody): string {
    // we assume that the request is for megolm keys, which are identified by
    // room id and session id
    return requestBody.room_id + " / " + requestBody.session_id;
}

function stringifyRecipientList(recipients: IRoomKeyRequestRecipient[]): string {
    return `[${recipients.map((r) => `${r.userId}:${r.deviceId}`).join(",")}]`;
}
