/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "../models/event";
import { logger } from "../logger";
import { CallDirection, CallError, CallErrorCode, CallState, createNewMatrixCall, MatrixCall } from "./call";
import { EventType } from "../@types/event";
import { ClientEvent, MatrixClient } from "../client";
import { MCallAnswer, MCallHangupReject } from "./callEventTypes";
import { GroupCall, GroupCallErrorCode, GroupCallEvent, GroupCallUnknownDeviceError } from "./groupCall";
import { RoomEvent } from "../models/room";

// Don't ring unless we'd be ringing for at least 3 seconds: the user needs some
// time to press the 'accept' button
const RING_GRACE_PERIOD = 3000;

export enum CallEventHandlerEvent {
    Incoming = "Call.incoming",
}

export type CallEventHandlerEventHandlerMap = {
    /**
     * Fires whenever an incoming call arrives.
     * @param call - The incoming call.
     * @example
     * ```
     * matrixClient.on("Call.incoming", function(call){
     *   call.answer(); // auto-answer
     * });
     * ```
     */
    [CallEventHandlerEvent.Incoming]: (call: MatrixCall) => void;
};

export class CallEventHandler {
    // XXX: Most of these are only public because of the tests
    public calls: Map<string, MatrixCall>;
    public callEventBuffer: MatrixEvent[];
    public nextSeqByCall: Map<string, number> = new Map();
    public toDeviceEventBuffers: Map<string, Array<MatrixEvent>> = new Map();

    private client: MatrixClient;
    private candidateEventsByCall: Map<string, Array<MatrixEvent>>;
    private eventBufferPromiseChain?: Promise<void>;

    public constructor(client: MatrixClient) {
        this.client = client;
        this.calls = new Map<string, MatrixCall>();
        // The sync code always emits one event at a time, so it will patiently
        // wait for us to finish processing a call invite before delivering the
        // next event, even if that next event is a hangup. We therefore accumulate
        // all our call events and then process them on the 'sync' event, ie.
        // each time a sync has completed. This way, we can avoid emitting incoming
        // call events if we get both the invite and answer/hangup in the same sync.
        // This happens quite often, eg. replaying sync from storage, catchup sync
        // after loading and after we've been offline for a bit.
        this.callEventBuffer = [];
        this.candidateEventsByCall = new Map<string, Array<MatrixEvent>>();
    }

    public start(): void {
        this.client.on(ClientEvent.Sync, this.onSync);
        this.client.on(RoomEvent.Timeline, this.onRoomTimeline);
        this.client.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    }

    public stop(): void {
        this.client.removeListener(ClientEvent.Sync, this.onSync);
        this.client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
        this.client.removeListener(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    }

    private onSync = (): void => {
        // Process the current event buffer and start queuing into a new one.
        const currentEventBuffer = this.callEventBuffer;
        this.callEventBuffer = [];

        // Ensure correct ordering by only processing this queue after the previous one has finished processing
        if (this.eventBufferPromiseChain) {
            this.eventBufferPromiseChain = this.eventBufferPromiseChain.then(() =>
                this.evaluateEventBuffer(currentEventBuffer),
            );
        } else {
            this.eventBufferPromiseChain = this.evaluateEventBuffer(currentEventBuffer);
        }
    };

    private async evaluateEventBuffer(eventBuffer: MatrixEvent[]): Promise<void> {
        await Promise.all(eventBuffer.map((event) => this.client.decryptEventIfNeeded(event)));

        const callEvents = eventBuffer.filter((event) => {
            const eventType = event.getType();
            return eventType.startsWith("m.call.") || eventType.startsWith("org.matrix.call.");
        });

        const ignoreCallIds = new Set<string>();

        // inspect the buffer and mark all calls which have been answered
        // or hung up before passing them to the call event handler.
        for (const event of callEvents) {
            const eventType = event.getType();

            if (eventType === EventType.CallAnswer || eventType === EventType.CallHangup) {
                ignoreCallIds.add(event.getContent().call_id);
            }
        }

        // Process call events in the order that they were received
        for (const event of callEvents) {
            const eventType = event.getType();
            const callId = event.getContent().call_id;

            if (eventType === EventType.CallInvite && ignoreCallIds.has(callId)) {
                // This call has previously been answered or hung up: ignore it
                continue;
            }

            try {
                await this.handleCallEvent(event);
            } catch (e) {
                logger.error("CallEventHandler evaluateEventBuffer() caught exception handling call event", e);
            }
        }
    }

    private onRoomTimeline = (event: MatrixEvent): void => {
        this.callEventBuffer.push(event);
    };

    private onToDeviceEvent = (event: MatrixEvent): void => {
        const content = event.getContent();

        if (!content.call_id) {
            this.callEventBuffer.push(event);
            return;
        }

        if (!this.nextSeqByCall.has(content.call_id)) {
            this.nextSeqByCall.set(content.call_id, 0);
        }

        if (content.seq === undefined) {
            this.callEventBuffer.push(event);
            return;
        }

        const nextSeq = this.nextSeqByCall.get(content.call_id) || 0;

        if (content.seq !== nextSeq) {
            if (!this.toDeviceEventBuffers.has(content.call_id)) {
                this.toDeviceEventBuffers.set(content.call_id, []);
            }

            const buffer = this.toDeviceEventBuffers.get(content.call_id)!;
            const index = buffer.findIndex((e) => e.getContent().seq > content.seq);

            if (index === -1) {
                buffer.push(event);
            } else {
                buffer.splice(index, 0, event);
            }
        } else {
            const callId = content.call_id;
            this.callEventBuffer.push(event);
            this.nextSeqByCall.set(callId, content.seq + 1);

            const buffer = this.toDeviceEventBuffers.get(callId);

            let nextEvent = buffer && buffer.shift();

            while (nextEvent && nextEvent.getContent().seq === this.nextSeqByCall.get(callId)) {
                this.callEventBuffer.push(nextEvent);
                this.nextSeqByCall.set(callId, nextEvent.getContent().seq + 1);
                nextEvent = buffer!.shift();
            }
        }
    };

    private async handleCallEvent(event: MatrixEvent): Promise<void> {
        this.client.emit(ClientEvent.ReceivedVoipEvent, event);

        const content = event.getContent();
        const callRoomId =
            event.getRoomId() || this.client.groupCallEventHandler!.getGroupCallById(content.conf_id)?.room?.roomId;
        const groupCallId = content.conf_id;
        const type = event.getType() as EventType;
        const senderId = event.getSender()!;
        let call = content.call_id ? this.calls.get(content.call_id) : undefined;

        let opponentDeviceId: string | undefined;

        let groupCall: GroupCall | undefined;
        if (groupCallId) {
            groupCall = this.client.groupCallEventHandler!.getGroupCallById(groupCallId);

            if (!groupCall) {
                logger.warn(
                    `CallEventHandler handleCallEvent() could not find a group call - ignoring event (groupCallId=${groupCallId}, type=${type})`,
                );
                return;
            }

            opponentDeviceId = content.device_id;

            if (!opponentDeviceId) {
                logger.warn(
                    `CallEventHandler handleCallEvent() could not find a device id - ignoring event (senderId=${senderId})`,
                );
                groupCall.emit(GroupCallEvent.Error, new GroupCallUnknownDeviceError(senderId));
                return;
            }

            if (content.dest_session_id !== this.client.getSessionId()) {
                logger.warn(
                    "CallEventHandler handleCallEvent() call event does not match current session id - ignoring",
                );
                return;
            }
        }

        const weSentTheEvent =
            senderId === this.client.credentials.userId &&
            (opponentDeviceId === undefined || opponentDeviceId === this.client.getDeviceId()!);

        if (!callRoomId) return;

        if (type === EventType.CallInvite) {
            // ignore invites you send
            if (weSentTheEvent) return;
            // expired call
            if (event.getLocalAge() > content.lifetime - RING_GRACE_PERIOD) return;
            // stale/old invite event
            if (call && call.state === CallState.Ended) return;

            if (call) {
                logger.warn(
                    `CallEventHandler handleCallEvent() already has a call but got an invite - clobbering (callId=${content.call_id})`,
                );
            }

            if (content.invitee && content.invitee !== this.client.getUserId()) {
                return; // This invite was meant for another user in the room
            }

            const timeUntilTurnCresExpire = (this.client.getTurnServersExpiry() ?? 0) - Date.now();
            logger.info(
                "CallEventHandler handleCallEvent() current turn creds expire in " + timeUntilTurnCresExpire + " ms",
            );
            call =
                createNewMatrixCall(this.client, callRoomId, {
                    forceTURN: this.client.forceTURN,
                    opponentDeviceId,
                    groupCallId,
                    opponentSessionId: content.sender_session_id,
                }) ?? undefined;
            if (!call) {
                logger.log(
                    `CallEventHandler handleCallEvent() this client does not support WebRTC (callId=${content.call_id})`,
                );
                // don't hang up the call: there could be other clients
                // connected that do support WebRTC and declining the
                // the call on their behalf would be really annoying.
                return;
            }

            call.callId = content.call_id;
            const stats = groupCall?.getGroupCallStats();
            if (stats) {
                call.initStats(stats);
            }

            try {
                await call.initWithInvite(event);
            } catch (e) {
                if (e instanceof CallError) {
                    if (e.code === GroupCallErrorCode.UnknownDevice) {
                        groupCall?.emit(GroupCallEvent.Error, e);
                    } else {
                        logger.error(e);
                    }
                }
            }
            this.calls.set(call.callId, call);

            // if we stashed candidate events for that call ID, play them back now
            if (this.candidateEventsByCall.get(call.callId)) {
                for (const ev of this.candidateEventsByCall.get(call.callId)!) {
                    call.onRemoteIceCandidatesReceived(ev);
                }
            }

            // Were we trying to call that user (room)?
            let existingCall: MatrixCall | undefined;
            for (const thisCall of this.calls.values()) {
                const isCalling = [CallState.WaitLocalMedia, CallState.CreateOffer, CallState.InviteSent].includes(
                    thisCall.state,
                );

                if (
                    call.roomId === thisCall.roomId &&
                    thisCall.direction === CallDirection.Outbound &&
                    call.getOpponentMember()?.userId === thisCall.invitee &&
                    isCalling
                ) {
                    existingCall = thisCall;
                    break;
                }
            }

            if (existingCall) {
                if (existingCall.callId > call.callId) {
                    logger.log(
                        `CallEventHandler handleCallEvent() detected glare - answering incoming call and canceling outgoing call (incomingId=${call.callId}, outgoingId=${existingCall.callId})`,
                    );
                    existingCall.replacedBy(call);
                } else {
                    logger.log(
                        `CallEventHandler handleCallEvent() detected glare - hanging up incoming call (incomingId=${call.callId}, outgoingId=${existingCall.callId})`,
                    );
                    call.hangup(CallErrorCode.Replaced, true);
                }
            } else {
                this.client.emit(CallEventHandlerEvent.Incoming, call);
            }
            return;
        } else if (type === EventType.CallCandidates) {
            if (weSentTheEvent) return;

            if (!call) {
                // store the candidates; we may get a call eventually.
                if (!this.candidateEventsByCall.has(content.call_id)) {
                    this.candidateEventsByCall.set(content.call_id, []);
                }
                this.candidateEventsByCall.get(content.call_id)!.push(event);
            } else {
                call.onRemoteIceCandidatesReceived(event);
            }
            return;
        } else if ([EventType.CallHangup, EventType.CallReject].includes(type)) {
            // Note that we also observe our own hangups here so we can see
            // if we've already rejected a call that would otherwise be valid
            if (!call) {
                // if not live, store the fact that the call has ended because
                // we're probably getting events backwards so
                // the hangup will come before the invite
                call =
                    createNewMatrixCall(this.client, callRoomId, {
                        opponentDeviceId,
                        opponentSessionId: content.sender_session_id,
                    }) ?? undefined;
                if (call) {
                    call.callId = content.call_id;
                    call.initWithHangup(event);
                    this.calls.set(content.call_id, call);
                }
            } else {
                if (call.state !== CallState.Ended) {
                    if (type === EventType.CallHangup) {
                        call.onHangupReceived(content as MCallHangupReject);
                    } else {
                        call.onRejectReceived(content as MCallHangupReject);
                    }

                    // @ts-expect-error typescript thinks the state can't be 'ended' because we're
                    // inside the if block where it wasn't, but it could have changed because
                    // on[Hangup|Reject]Received are side-effecty.
                    if (call.state === CallState.Ended) this.calls.delete(content.call_id);
                }
            }
            return;
        }

        // The following events need a call and a peer connection
        if (!call || !call.hasPeerConnection) {
            logger.info(
                `CallEventHandler handleCallEvent() discarding possible call event as we don't have a call (type=${type})`,
            );
            return;
        }
        // Ignore remote echo
        if (event.getContent().party_id === call.ourPartyId) return;

        switch (type) {
            case EventType.CallAnswer:
                if (weSentTheEvent) {
                    if (call.state === CallState.Ringing) {
                        call.onAnsweredElsewhere(content as MCallAnswer);
                    }
                } else {
                    call.onAnswerReceived(event);
                }
                break;
            case EventType.CallSelectAnswer:
                call.onSelectAnswerReceived(event);
                break;

            case EventType.CallNegotiate:
                call.onNegotiateReceived(event);
                break;

            case EventType.CallAssertedIdentity:
            case EventType.CallAssertedIdentityPrefix:
                call.onAssertedIdentityReceived(event);
                break;

            case EventType.CallSDPStreamMetadataChanged:
            case EventType.CallSDPStreamMetadataChangedPrefix:
                call.onSDPStreamMetadataChangedReceived(event);
                break;
        }
    }
}
