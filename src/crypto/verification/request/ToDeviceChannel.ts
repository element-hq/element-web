/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { randomString } from "../../../randomstring";
import { logger } from "../../../logger";
import {
    CANCEL_TYPE,
    PHASE_STARTED,
    PHASE_READY,
    REQUEST_TYPE,
    READY_TYPE,
    START_TYPE,
    VerificationRequest,
} from "./VerificationRequest";
import { errorFromEvent, newUnexpectedMessageError } from "../Error";
import { MatrixEvent } from "../../../models/event";
import { IVerificationChannel } from "./Channel";
import { MatrixClient } from "../../../client";
import { IRequestsMap } from "../..";

export type Request = VerificationRequest<ToDeviceChannel>;

/**
 * A key verification channel that sends verification events over to_device messages.
 * Generates its own transaction ids.
 */
export class ToDeviceChannel implements IVerificationChannel {
    public request?: VerificationRequest;

    // userId and devices of user we're about to verify
    public constructor(
        private readonly client: MatrixClient,
        public readonly userId: string,
        private readonly devices: string[],
        public transactionId?: string,
        public deviceId?: string,
    ) {}

    public isToDevices(devices: string[]): boolean {
        if (devices.length === this.devices.length) {
            for (const device of devices) {
                if (!this.devices.includes(device)) {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    }

    public static getEventType(event: MatrixEvent): string {
        return event.getType();
    }

    /**
     * Extract the transaction id used by a given key verification event, if any
     * @param event - the event
     * @returns the transaction id
     */
    public static getTransactionId(event: MatrixEvent): string {
        const content = event.getContent();
        return content && content.transaction_id;
    }

    /**
     * Checks whether the given event type should be allowed to initiate a new VerificationRequest over this channel
     * @param type - the event type to check
     * @returns boolean flag
     */
    public static canCreateRequest(type: string): boolean {
        return type === REQUEST_TYPE || type === START_TYPE;
    }

    public canCreateRequest(type: string): boolean {
        return ToDeviceChannel.canCreateRequest(type);
    }

    /**
     * Checks whether this event is a well-formed key verification event.
     * This only does checks that don't rely on the current state of a potentially already channel
     * so we can prevent channels being created by invalid events.
     * `handleEvent` can do more checks and choose to ignore invalid events.
     * @param event - the event to validate
     * @param client - the client to get the current user and device id from
     * @returns whether the event is valid and should be passed to handleEvent
     */
    public static validateEvent(event: MatrixEvent, client: MatrixClient): boolean {
        if (event.isCancelled()) {
            logger.warn("Ignoring flagged verification request from " + event.getSender());
            return false;
        }
        const content = event.getContent();
        if (!content) {
            logger.warn("ToDeviceChannel.validateEvent: invalid: no content");
            return false;
        }

        if (!content.transaction_id) {
            logger.warn("ToDeviceChannel.validateEvent: invalid: no transaction_id");
            return false;
        }

        const type = event.getType();

        if (type === REQUEST_TYPE) {
            if (!Number.isFinite(content.timestamp)) {
                logger.warn("ToDeviceChannel.validateEvent: invalid: no timestamp");
                return false;
            }
            if (event.getSender() === client.getUserId() && content.from_device == client.getDeviceId()) {
                // ignore requests from ourselves, because it doesn't make sense for a
                // device to verify itself
                logger.warn("ToDeviceChannel.validateEvent: invalid: from own device");
                return false;
            }
        }

        return VerificationRequest.validateEvent(type, event, client);
    }

    /**
     * @param event - the event to get the timestamp of
     * @returns the timestamp when the event was sent
     */
    public getTimestamp(event: MatrixEvent): number {
        const content = event.getContent();
        return content && content.timestamp;
    }

    /**
     * Changes the state of the channel, request, and verifier in response to a key verification event.
     * @param event - to handle
     * @param request - the request to forward handling to
     * @param isLiveEvent - whether this is an even received through sync or not
     * @returns a promise that resolves when any requests as an answer to the passed-in event are sent.
     */
    public async handleEvent(event: MatrixEvent, request: Request, isLiveEvent = false): Promise<void> {
        const type = event.getType();
        const content = event.getContent();
        if (type === REQUEST_TYPE || type === READY_TYPE || type === START_TYPE) {
            if (!this.transactionId) {
                this.transactionId = content.transaction_id;
            }
            const deviceId = content.from_device;
            // adopt deviceId if not set before and valid
            if (!this.deviceId && this.devices.includes(deviceId)) {
                this.deviceId = deviceId;
            }
            // if no device id or different from adopted one, cancel with sender
            if (!this.deviceId || this.deviceId !== deviceId) {
                // also check that message came from the device we sent the request to earlier on
                // and do send a cancel message to that device
                // (but don't cancel the request for the device we should be talking to)
                const cancelContent = this.completeContent(CANCEL_TYPE, errorFromEvent(newUnexpectedMessageError()));
                return this.sendToDevices(CANCEL_TYPE, cancelContent, [deviceId]);
            }
        }
        const wasStarted = request.phase === PHASE_STARTED || request.phase === PHASE_READY;

        await request.handleEvent(event.getType(), event, isLiveEvent, false, false);

        const isStarted = request.phase === PHASE_STARTED || request.phase === PHASE_READY;

        const isAcceptingEvent = type === START_TYPE || type === READY_TYPE;
        // the request has picked a ready or start event, tell the other devices about it
        if (isAcceptingEvent && !wasStarted && isStarted && this.deviceId) {
            const nonChosenDevices = this.devices.filter((d) => d !== this.deviceId && d !== this.client.getDeviceId());
            if (nonChosenDevices.length) {
                const message = this.completeContent(CANCEL_TYPE, {
                    code: "m.accepted",
                    reason: "Verification request accepted by another device",
                });
                await this.sendToDevices(CANCEL_TYPE, message, nonChosenDevices);
            }
        }
    }

    /**
     * See {@link InRoomChannel#completedContentFromEvent} for why this is needed.
     * @param event - the received event
     * @returns the content object
     */
    public completedContentFromEvent(event: MatrixEvent): Record<string, any> {
        return event.getContent();
    }

    /**
     * Add all the fields to content needed for sending it over this channel.
     * This is public so verification methods (SAS uses this) can get the exact
     * content that will be sent independent of the used channel,
     * as they need to calculate the hash of it.
     * @param type - the event type
     * @param content - the (incomplete) content
     * @returns the complete content, as it will be sent.
     */
    public completeContent(type: string, content: Record<string, any>): Record<string, any> {
        // make a copy
        content = Object.assign({}, content);
        if (this.transactionId) {
            content.transaction_id = this.transactionId;
        }
        if (type === REQUEST_TYPE || type === READY_TYPE || type === START_TYPE) {
            content.from_device = this.client.getDeviceId();
        }
        if (type === REQUEST_TYPE) {
            content.timestamp = Date.now();
        }
        return content;
    }

    /**
     * Send an event over the channel with the content not having gone through `completeContent`.
     * @param type - the event type
     * @param uncompletedContent - the (incomplete) content
     * @returns the promise of the request
     */
    public send(type: string, uncompletedContent: Record<string, any> = {}): Promise<void> {
        // create transaction id when sending request
        if ((type === REQUEST_TYPE || type === START_TYPE) && !this.transactionId) {
            this.transactionId = ToDeviceChannel.makeTransactionId();
        }
        const content = this.completeContent(type, uncompletedContent);
        return this.sendCompleted(type, content);
    }

    /**
     * Send an event over the channel with the content having gone through `completeContent` already.
     * @param type - the event type
     * @returns the promise of the request
     */
    public async sendCompleted(type: string, content: Record<string, any>): Promise<void> {
        let result;
        if (type === REQUEST_TYPE || (type === CANCEL_TYPE && !this.deviceId)) {
            result = await this.sendToDevices(type, content, this.devices);
        } else {
            result = await this.sendToDevices(type, content, [this.deviceId!]);
        }
        // the VerificationRequest state machine requires remote echos of the event
        // the client sends itself, so we fake this for to_device messages
        const remoteEchoEvent = new MatrixEvent({
            sender: this.client.getUserId()!,
            content,
            type,
        });
        await this.request!.handleEvent(
            type,
            remoteEchoEvent,
            /*isLiveEvent=*/ true,
            /*isRemoteEcho=*/ true,
            /*isSentByUs=*/ true,
        );
        return result;
    }

    private async sendToDevices(type: string, content: Record<string, any>, devices: string[]): Promise<void> {
        if (devices.length) {
            const deviceMessages: Map<string, Record<string, any>> = new Map();
            for (const deviceId of devices) {
                deviceMessages.set(deviceId, content);
            }

            await this.client.sendToDevice(type, new Map([[this.userId, deviceMessages]]));
        }
    }

    /**
     * Allow Crypto module to create and know the transaction id before the .start event gets sent.
     * @returns the transaction id
     */
    public static makeTransactionId(): string {
        return randomString(32);
    }
}

export class ToDeviceRequests implements IRequestsMap {
    private requestsByUserId = new Map<string, Map<string, Request>>();

    public getRequest(event: MatrixEvent): Request | undefined {
        return this.getRequestBySenderAndTxnId(event.getSender()!, ToDeviceChannel.getTransactionId(event));
    }

    public getRequestByChannel(channel: ToDeviceChannel): Request | undefined {
        return this.getRequestBySenderAndTxnId(channel.userId, channel.transactionId!);
    }

    public getRequestBySenderAndTxnId(sender: string, txnId: string): Request | undefined {
        const requestsByTxnId = this.requestsByUserId.get(sender);
        if (requestsByTxnId) {
            return requestsByTxnId.get(txnId);
        }
    }

    public setRequest(event: MatrixEvent, request: Request): void {
        this.setRequestBySenderAndTxnId(event.getSender()!, ToDeviceChannel.getTransactionId(event), request);
    }

    public setRequestByChannel(channel: ToDeviceChannel, request: Request): void {
        this.setRequestBySenderAndTxnId(channel.userId, channel.transactionId!, request);
    }

    public setRequestBySenderAndTxnId(sender: string, txnId: string, request: Request): void {
        let requestsByTxnId = this.requestsByUserId.get(sender);
        if (!requestsByTxnId) {
            requestsByTxnId = new Map();
            this.requestsByUserId.set(sender, requestsByTxnId);
        }
        requestsByTxnId.set(txnId, request);
    }

    public removeRequest(event: MatrixEvent): void {
        const userId = event.getSender()!;
        const requestsByTxnId = this.requestsByUserId.get(userId);
        if (requestsByTxnId) {
            requestsByTxnId.delete(ToDeviceChannel.getTransactionId(event));
            if (requestsByTxnId.size === 0) {
                this.requestsByUserId.delete(userId);
            }
        }
    }

    public findRequestInProgress(userId: string, devices: string[]): Request | undefined {
        const requestsByTxnId = this.requestsByUserId.get(userId);
        if (requestsByTxnId) {
            for (const request of requestsByTxnId.values()) {
                if (request.pending && request.channel.isToDevices(devices)) {
                    return request;
                }
            }
        }
    }

    public getRequestsInProgress(userId: string): Request[] {
        const requestsByTxnId = this.requestsByUserId.get(userId);
        if (requestsByTxnId) {
            return Array.from(requestsByTxnId.values()).filter((r) => r.pending);
        }
        return [];
    }
}
