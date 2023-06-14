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

import { VerificationRequest, REQUEST_TYPE, READY_TYPE, START_TYPE } from "./VerificationRequest";
import { logger } from "../../../logger";
import { IVerificationChannel } from "./Channel";
import { EventType } from "../../../@types/event";
import { MatrixClient } from "../../../client";
import { MatrixEvent } from "../../../models/event";
import { IRequestsMap } from "../..";

const MESSAGE_TYPE = EventType.RoomMessage;
const M_REFERENCE = "m.reference";
const M_RELATES_TO = "m.relates_to";

/**
 * A key verification channel that sends verification events in the timeline of a room.
 * Uses the event id of the initial m.key.verification.request event as a transaction id.
 */
export class InRoomChannel implements IVerificationChannel {
    private requestEventId?: string;

    /**
     * @param client - the matrix client, to send messages with and get current user & device from.
     * @param roomId - id of the room where verification events should be posted in, should be a DM with the given user.
     * @param userId - id of user that the verification request is directed at, should be present in the room.
     */
    public constructor(private readonly client: MatrixClient, public readonly roomId: string, public userId?: string) {}

    public get receiveStartFromOtherDevices(): boolean {
        return true;
    }

    /** The transaction id generated/used by this verification channel */
    public get transactionId(): string | undefined {
        return this.requestEventId;
    }

    public static getOtherPartyUserId(event: MatrixEvent, client: MatrixClient): string | undefined {
        const type = InRoomChannel.getEventType(event);
        if (type !== REQUEST_TYPE) {
            return;
        }
        const ownUserId = client.getUserId();
        const sender = event.getSender();
        const content = event.getContent();
        const receiver = content.to;

        if (sender === ownUserId) {
            return receiver;
        } else if (receiver === ownUserId) {
            return sender;
        }
    }

    /**
     * @param event - the event to get the timestamp of
     * @returns the timestamp when the event was sent
     */
    public getTimestamp(event: MatrixEvent): number {
        return event.getTs();
    }

    /**
     * Checks whether the given event type should be allowed to initiate a new VerificationRequest over this channel
     * @param type - the event type to check
     * @returns boolean flag
     */
    public static canCreateRequest(type: string): boolean {
        return type === REQUEST_TYPE;
    }

    public canCreateRequest(type: string): boolean {
        return InRoomChannel.canCreateRequest(type);
    }

    /**
     * Extract the transaction id used by a given key verification event, if any
     * @param event - the event
     * @returns the transaction id
     */
    public static getTransactionId(event: MatrixEvent): string | undefined {
        if (InRoomChannel.getEventType(event) === REQUEST_TYPE) {
            return event.getId();
        } else {
            const relation = event.getRelation();
            if (relation?.rel_type === M_REFERENCE) {
                return relation.event_id;
            }
        }
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
        const txnId = InRoomChannel.getTransactionId(event);
        if (typeof txnId !== "string" || txnId.length === 0) {
            return false;
        }
        const type = InRoomChannel.getEventType(event);
        const content = event.getContent();

        // from here on we're fairly sure that this is supposed to be
        // part of a verification request, so be noisy when rejecting something
        if (type === REQUEST_TYPE) {
            if (!content || typeof content.to !== "string" || !content.to.length) {
                logger.log("InRoomChannel: validateEvent: " + "no valid to " + content.to);
                return false;
            }

            // ignore requests that are not direct to or sent by the syncing user
            if (!InRoomChannel.getOtherPartyUserId(event, client)) {
                logger.log(
                    "InRoomChannel: validateEvent: " +
                        `not directed to or sent by me: ${event.getSender()}` +
                        `, ${content.to}`,
                );
                return false;
            }
        }

        return VerificationRequest.validateEvent(type, event, client);
    }

    /**
     * As m.key.verification.request events are as m.room.message events with the InRoomChannel
     * to have a fallback message in non-supporting clients, we map the real event type
     * to the symbolic one to keep things in unison with ToDeviceChannel
     * @param event - the event to get the type of
     * @returns the "symbolic" event type
     */
    public static getEventType(event: MatrixEvent): string {
        const type = event.getType();
        if (type === MESSAGE_TYPE) {
            const content = event.getContent();
            if (content) {
                const { msgtype } = content;
                if (msgtype === REQUEST_TYPE) {
                    return REQUEST_TYPE;
                }
            }
        }
        if (type && type !== REQUEST_TYPE) {
            return type;
        } else {
            return "";
        }
    }

    /**
     * Changes the state of the channel, request, and verifier in response to a key verification event.
     * @param event - to handle
     * @param request - the request to forward handling to
     * @param isLiveEvent - whether this is an even received through sync or not
     * @returns a promise that resolves when any requests as an answer to the passed-in event are sent.
     */
    public async handleEvent(event: MatrixEvent, request: VerificationRequest, isLiveEvent = false): Promise<void> {
        // prevent processing the same event multiple times, as under
        // some circumstances Room.timeline can get emitted twice for the same event
        if (request.hasEventId(event.getId()!)) {
            return;
        }
        const type = InRoomChannel.getEventType(event);
        // do validations that need state (roomId, userId),
        // ignore if invalid

        if (event.getRoomId() !== this.roomId) {
            return;
        }
        // set userId if not set already
        if (!this.userId) {
            const userId = InRoomChannel.getOtherPartyUserId(event, this.client);
            if (userId) {
                this.userId = userId;
            }
        }
        // ignore events not sent by us or the other party
        const ownUserId = this.client.getUserId();
        const sender = event.getSender();
        if (this.userId) {
            if (sender !== ownUserId && sender !== this.userId) {
                logger.log(`InRoomChannel: ignoring verification event from non-participating sender ${sender}`);
                return;
            }
        }
        if (!this.requestEventId) {
            this.requestEventId = InRoomChannel.getTransactionId(event);
        }

        // With pendingEventOrdering: "chronological", we will see events that have been sent but not yet reflected
        // back via /sync. These are "local echoes" and are identifiable by their txnId
        const isLocalEcho = !!event.getTxnId();

        // Alternatively, we may see an event that we sent that is reflected back via /sync. These are "remote echoes"
        // and have a transaction ID in the "unsigned" data
        const isRemoteEcho = !!event.getUnsigned().transaction_id;

        const isSentByUs = event.getSender() === this.client.getUserId();

        return request.handleEvent(type, event, isLiveEvent, isLocalEcho || isRemoteEcho, isSentByUs);
    }

    /**
     * Adds the transaction id (relation) back to a received event
     * so it has the same format as returned by `completeContent` before sending.
     * The relation can not appear on the event content because of encryption,
     * relations are excluded from encryption.
     * @param event - the received event
     * @returns the content object with the relation added again
     */
    public completedContentFromEvent(event: MatrixEvent): Record<string, any> {
        // ensure m.related_to is included in e2ee rooms
        // as the field is excluded from encryption
        const content = Object.assign({}, event.getContent());
        content[M_RELATES_TO] = event.getRelation()!;
        return content;
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
        content = Object.assign({}, content);
        if (type === REQUEST_TYPE || type === READY_TYPE || type === START_TYPE) {
            content.from_device = this.client.getDeviceId();
        }
        if (type === REQUEST_TYPE) {
            // type is mapped to m.room.message in the send method
            content = {
                body:
                    this.client.getUserId() +
                    " is requesting to verify " +
                    "your key, but your client does not support in-chat key " +
                    "verification.  You will need to use legacy key " +
                    "verification to verify keys.",
                msgtype: REQUEST_TYPE,
                to: this.userId,
                from_device: content.from_device,
                methods: content.methods,
            };
        } else {
            content[M_RELATES_TO] = {
                rel_type: M_REFERENCE,
                event_id: this.transactionId,
            };
        }
        return content;
    }

    /**
     * Send an event over the channel with the content not having gone through `completeContent`.
     * @param type - the event type
     * @param uncompletedContent - the (incomplete) content
     * @returns the promise of the request
     */
    public send(type: string, uncompletedContent: Record<string, any>): Promise<void> {
        const content = this.completeContent(type, uncompletedContent);
        return this.sendCompleted(type, content);
    }

    /**
     * Send an event over the channel with the content having gone through `completeContent` already.
     * @param type - the event type
     * @returns the promise of the request
     */
    public async sendCompleted(type: string, content: Record<string, any>): Promise<void> {
        let sendType = type;
        if (type === REQUEST_TYPE) {
            sendType = MESSAGE_TYPE;
        }
        const response = await this.client.sendEvent(this.roomId, sendType, content);
        if (type === REQUEST_TYPE) {
            this.requestEventId = response.event_id;
        }
    }
}

export class InRoomRequests implements IRequestsMap {
    private requestsByRoomId = new Map<string, Map<string, VerificationRequest>>();

    public getRequest(event: MatrixEvent): VerificationRequest | undefined {
        const roomId = event.getRoomId()!;
        const txnId = InRoomChannel.getTransactionId(event)!;
        return this.getRequestByTxnId(roomId, txnId);
    }

    public getRequestByChannel(channel: InRoomChannel): VerificationRequest | undefined {
        return this.getRequestByTxnId(channel.roomId, channel.transactionId!);
    }

    private getRequestByTxnId(roomId: string, txnId: string): VerificationRequest | undefined {
        const requestsByTxnId = this.requestsByRoomId.get(roomId);
        if (requestsByTxnId) {
            return requestsByTxnId.get(txnId);
        }
    }

    public setRequest(event: MatrixEvent, request: VerificationRequest): void {
        this.doSetRequest(event.getRoomId()!, InRoomChannel.getTransactionId(event)!, request);
    }

    public setRequestByChannel(channel: IVerificationChannel, request: VerificationRequest): void {
        this.doSetRequest(channel.roomId!, channel.transactionId!, request);
    }

    private doSetRequest(roomId: string, txnId: string, request: VerificationRequest): void {
        let requestsByTxnId = this.requestsByRoomId.get(roomId);
        if (!requestsByTxnId) {
            requestsByTxnId = new Map();
            this.requestsByRoomId.set(roomId, requestsByTxnId);
        }
        requestsByTxnId.set(txnId, request);
    }

    public removeRequest(event: MatrixEvent): void {
        const roomId = event.getRoomId()!;
        const requestsByTxnId = this.requestsByRoomId.get(roomId);
        if (requestsByTxnId) {
            requestsByTxnId.delete(InRoomChannel.getTransactionId(event)!);
            if (requestsByTxnId.size === 0) {
                this.requestsByRoomId.delete(roomId);
            }
        }
    }

    public findRequestInProgress(roomId: string): VerificationRequest | undefined {
        const requestsByTxnId = this.requestsByRoomId.get(roomId);
        if (requestsByTxnId) {
            for (const request of requestsByTxnId.values()) {
                if (request.pending) {
                    return request;
                }
            }
        }
    }
}
