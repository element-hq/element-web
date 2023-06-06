/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React from "react";
import { MatrixError } from "matrix-js-sdk/src/matrix";
import {
    CallError,
    CallErrorCode,
    CallEvent,
    CallParty,
    CallState,
    CallType,
    FALLBACK_ICE_SERVER,
    MatrixCall,
} from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";
import EventEmitter from "events";
import { RuleId, TweakName } from "matrix-js-sdk/src/@types/PushRules";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { SyncState } from "matrix-js-sdk/src/sync";
import { CallEventHandlerEvent } from "matrix-js-sdk/src/webrtc/callEventHandler";

import { MatrixClientPeg } from "./MatrixClientPeg";
import Modal from "./Modal";
import { _t } from "./languageHandler";
import dis from "./dispatcher/dispatcher";
import WidgetUtils from "./utils/WidgetUtils";
import SettingsStore from "./settings/SettingsStore";
import { WidgetType } from "./widgets/WidgetType";
import { SettingLevel } from "./settings/SettingLevel";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import WidgetStore from "./stores/WidgetStore";
import { WidgetMessagingStore } from "./stores/widgets/WidgetMessagingStore";
import { ElementWidgetActions } from "./stores/widgets/ElementWidgetActions";
import { UIFeature } from "./settings/UIFeature";
import { Action } from "./dispatcher/actions";
import VoipUserMapper from "./VoipUserMapper";
import { addManagedHybridWidget, isManagedHybridWidgetEnabled } from "./widgets/ManagedHybrid";
import SdkConfig from "./SdkConfig";
import { ensureDMExists } from "./createRoom";
import { Container, WidgetLayoutStore } from "./stores/widgets/WidgetLayoutStore";
import IncomingLegacyCallToast, { getIncomingLegacyCallToastKey } from "./toasts/IncomingLegacyCallToast";
import ToastStore from "./stores/ToastStore";
import Resend from "./Resend";
import { ViewRoomPayload } from "./dispatcher/payloads/ViewRoomPayload";
import { InviteKind } from "./components/views/dialogs/InviteDialogTypes";
import { OpenInviteDialogPayload } from "./dispatcher/payloads/OpenInviteDialogPayload";
import { findDMForUser } from "./utils/dm/findDMForUser";
import { getJoinedNonFunctionalMembers } from "./utils/room/getJoinedNonFunctionalMembers";
import { localNotificationsAreSilenced } from "./utils/notifications";
import { SdkContextClass } from "./contexts/SDKContext";
import { showCantStartACallDialog } from "./voice-broadcast/utils/showCantStartACallDialog";
import { isNotNull } from "./Typeguards";

export const PROTOCOL_PSTN = "m.protocol.pstn";
export const PROTOCOL_PSTN_PREFIXED = "im.vector.protocol.pstn";
export const PROTOCOL_SIP_NATIVE = "im.vector.protocol.sip_native";
export const PROTOCOL_SIP_VIRTUAL = "im.vector.protocol.sip_virtual";

const CHECK_PROTOCOLS_ATTEMPTS = 3;

type MediaEventType = keyof HTMLMediaElementEventMap;
const MEDIA_ERROR_EVENT_TYPES: MediaEventType[] = [
    "error",
    // The media has become empty; for example, this event is sent if the media has
    // already been loaded (or partially loaded), and the HTMLMediaElement.load method
    // is called to reload it.
    "emptied",
    // The user agent is trying to fetch media data, but data is unexpectedly not
    // forthcoming.
    "stalled",
    // Media data loading has been suspended.
    "suspend",
    // Playback has stopped because of a temporary lack of data
    "waiting",
];
const MEDIA_DEBUG_EVENT_TYPES: MediaEventType[] = [
    "play",
    "pause",
    "playing",
    "ended",
    "loadeddata",
    "loadedmetadata",
    "canplay",
    "canplaythrough",
    "volumechange",
];

const MEDIA_EVENT_TYPES = [...MEDIA_ERROR_EVENT_TYPES, ...MEDIA_DEBUG_EVENT_TYPES];

export enum AudioID {
    Ring = "ringAudio",
    Ringback = "ringbackAudio",
    CallEnd = "callendAudio",
    Busy = "busyAudio",
}

/* istanbul ignore next */
const debuglog = (...args: any[]): void => {
    if (SettingsStore.getValue("debug_legacy_call_handler")) {
        logger.log.call(console, "LegacyCallHandler debuglog:", ...args);
    }
};

interface ThirdpartyLookupResponseFields {
    /* eslint-disable camelcase */

    // im.vector.sip_native
    virtual_mxid?: string;
    is_virtual?: boolean;

    // im.vector.sip_virtual
    native_mxid?: string;
    is_native?: boolean;

    // common
    lookup_success?: boolean;

    /* eslint-enable camelcase */
}

interface ThirdpartyLookupResponse {
    userid: string;
    protocol: string;
    fields: ThirdpartyLookupResponseFields;
}

export enum LegacyCallHandlerEvent {
    CallsChanged = "calls_changed",
    CallChangeRoom = "call_change_room",
    SilencedCallsChanged = "silenced_calls_changed",
    CallState = "call_state",
}

/**
 * LegacyCallHandler manages all currently active calls. It should be used for
 * placing, answering, rejecting and hanging up calls. It also handles ringing,
 * PSTN support and other things.
 */
export default class LegacyCallHandler extends EventEmitter {
    private calls = new Map<string, MatrixCall>(); // roomId -> call
    // Calls started as an attended transfer, ie. with the intention of transferring another
    // call with a different party to this one.
    private transferees = new Map<string, MatrixCall>(); // callId (target) -> call (transferee)
    private audioPromises = new Map<AudioID, Promise<void>>();
    private audioElementsWithListeners = new Map<HTMLMediaElement, boolean>();
    private supportsPstnProtocol: boolean | null = null;
    private pstnSupportPrefixed: boolean | null = null; // True if the server only support the prefixed pstn protocol
    private supportsSipNativeVirtual: boolean | null = null; // im.vector.protocol.sip_virtual and im.vector.protocol.sip_native

    // Map of the asserted identity users after we've looked them up using the API.
    // We need to be be able to determine the mapped room synchronously, so we
    // do the async lookup when we get new information and then store these mappings here
    private assertedIdentityNativeUsers = new Map<string, string>();

    private silencedCalls = new Set<string>(); // callIds

    public static get instance(): LegacyCallHandler {
        if (!window.mxLegacyCallHandler) {
            window.mxLegacyCallHandler = new LegacyCallHandler();
        }

        return window.mxLegacyCallHandler;
    }

    /*
     * Gets the user-facing room associated with a call (call.roomId may be the call "virtual room"
     * if a voip_mxid_translate_pattern is set in the config)
     */
    public roomIdForCall(call?: MatrixCall): string | null {
        if (!call) return null;

        // check asserted identity: if we're not obeying asserted identity,
        // this map will never be populated, but we check anyway for sanity
        if (this.shouldObeyAssertedfIdentity()) {
            const nativeUser = this.assertedIdentityNativeUsers.get(call.callId);
            if (nativeUser) {
                const room = findDMForUser(MatrixClientPeg.get(), nativeUser);
                if (room) return room.roomId;
            }
        }

        return VoipUserMapper.sharedInstance().nativeRoomForVirtualRoom(call.roomId) ?? call.roomId ?? null;
    }

    public start(): void {
        // add empty handlers for media actions, otherwise the media keys
        // end up causing the audio elements with our ring/ringback etc
        // audio clips in to play.
        if (navigator.mediaSession) {
            navigator.mediaSession.setActionHandler("play", function () {});
            navigator.mediaSession.setActionHandler("pause", function () {});
            navigator.mediaSession.setActionHandler("seekbackward", function () {});
            navigator.mediaSession.setActionHandler("seekforward", function () {});
            navigator.mediaSession.setActionHandler("previoustrack", function () {});
            navigator.mediaSession.setActionHandler("nexttrack", function () {});
        }

        if (SettingsStore.getValue(UIFeature.Voip)) {
            MatrixClientPeg.get().on(CallEventHandlerEvent.Incoming, this.onCallIncoming);
        }

        this.checkProtocols(CHECK_PROTOCOLS_ATTEMPTS);

        // Add event listeners for the <audio> elements
        Object.values(AudioID).forEach((audioId) => {
            const audioElement = document.getElementById(audioId) as HTMLMediaElement;
            if (audioElement) {
                this.addEventListenersForAudioElement(audioElement);
            } else {
                logger.warn(`LegacyCallHandler: missing <audio id="${audioId}"> from page`);
            }
        });
    }

    public stop(): void {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener(CallEventHandlerEvent.Incoming, this.onCallIncoming);
        }

        // Remove event listeners for the <audio> elements
        Array.from(this.audioElementsWithListeners.keys()).forEach((audioElement) => {
            this.removeEventListenersForAudioElement(audioElement);
        });
    }

    private addEventListenersForAudioElement(audioElement: HTMLMediaElement): void {
        // Only need to setup the listeners once
        if (!this.audioElementsWithListeners.get(audioElement)) {
            MEDIA_EVENT_TYPES.forEach((errorEventType) => {
                audioElement.addEventListener(errorEventType, this);
                this.audioElementsWithListeners.set(audioElement, true);
            });
        }
    }

    private removeEventListenersForAudioElement(audioElement: HTMLMediaElement): void {
        MEDIA_EVENT_TYPES.forEach((errorEventType) => {
            audioElement.removeEventListener(errorEventType, this);
        });
    }

    /* istanbul ignore next (remove if we start using this function for things other than debug logging) */
    public handleEvent(e: Event): void {
        const target = e.target as HTMLElement;
        const audioId = target?.id;

        if (MEDIA_ERROR_EVENT_TYPES.includes(e.type as MediaEventType)) {
            logger.error(`LegacyCallHandler: encountered "${e.type}" event with <audio id="${audioId}">`, e);
        } else if (MEDIA_EVENT_TYPES.includes(e.type as MediaEventType)) {
            debuglog(`encountered "${e.type}" event with <audio id="${audioId}">`, e);
        }
    }

    public isForcedSilent(): boolean {
        const cli = MatrixClientPeg.get();
        return localNotificationsAreSilenced(cli);
    }

    public silenceCall(callId?: string): void {
        if (!callId) return;
        this.silencedCalls.add(callId);
        this.emit(LegacyCallHandlerEvent.SilencedCallsChanged, this.silencedCalls);

        // Don't pause audio if we have calls which are still ringing
        if (this.areAnyCallsUnsilenced()) return;
        this.pause(AudioID.Ring);
    }

    public unSilenceCall(callId?: string): void {
        if (!callId || this.isForcedSilent()) return;
        this.silencedCalls.delete(callId);
        this.emit(LegacyCallHandlerEvent.SilencedCallsChanged, this.silencedCalls);
        this.play(AudioID.Ring);
    }

    public isCallSilenced(callId?: string): boolean {
        return this.isForcedSilent() || (!!callId && this.silencedCalls.has(callId));
    }

    /**
     * Returns true if there is at least one unsilenced call
     * @returns {boolean}
     */
    private areAnyCallsUnsilenced(): boolean {
        for (const call of this.calls.values()) {
            if (call.state === CallState.Ringing && !this.isCallSilenced(call.callId)) {
                return true;
            }
        }
        return false;
    }

    private async checkProtocols(maxTries: number): Promise<void> {
        try {
            const protocols = await MatrixClientPeg.get().getThirdpartyProtocols();

            if (protocols[PROTOCOL_PSTN] !== undefined) {
                this.supportsPstnProtocol = Boolean(protocols[PROTOCOL_PSTN]);
                if (this.supportsPstnProtocol) this.pstnSupportPrefixed = false;
            } else if (protocols[PROTOCOL_PSTN_PREFIXED] !== undefined) {
                this.supportsPstnProtocol = Boolean(protocols[PROTOCOL_PSTN_PREFIXED]);
                if (this.supportsPstnProtocol) this.pstnSupportPrefixed = true;
            } else {
                this.supportsPstnProtocol = null;
            }

            dis.dispatch({ action: Action.PstnSupportUpdated });

            if (protocols[PROTOCOL_SIP_NATIVE] !== undefined && protocols[PROTOCOL_SIP_VIRTUAL] !== undefined) {
                this.supportsSipNativeVirtual = Boolean(
                    protocols[PROTOCOL_SIP_NATIVE] && protocols[PROTOCOL_SIP_VIRTUAL],
                );
            }

            dis.dispatch({ action: Action.VirtualRoomSupportUpdated });
        } catch (e) {
            if (maxTries === 1) {
                logger.log("Failed to check for protocol support and no retries remain: assuming no support", e);
            } else {
                logger.log("Failed to check for protocol support: will retry", e);
                window.setTimeout(() => {
                    this.checkProtocols(maxTries - 1);
                }, 10000);
            }
        }
    }

    private shouldObeyAssertedfIdentity(): boolean {
        return !!SdkConfig.getObject("voip")?.get("obey_asserted_identity");
    }

    public getSupportsPstnProtocol(): boolean | null {
        return this.supportsPstnProtocol;
    }

    public getSupportsVirtualRooms(): boolean | null {
        return this.supportsSipNativeVirtual;
    }

    public async pstnLookup(phoneNumber: string): Promise<ThirdpartyLookupResponse[]> {
        try {
            return await MatrixClientPeg.get().getThirdpartyUser(
                this.pstnSupportPrefixed ? PROTOCOL_PSTN_PREFIXED : PROTOCOL_PSTN,
                {
                    "m.id.phone": phoneNumber,
                },
            );
        } catch (e) {
            logger.warn("Failed to lookup user from phone number", e);
            return Promise.resolve([]);
        }
    }

    public async sipVirtualLookup(nativeMxid: string): Promise<ThirdpartyLookupResponse[]> {
        try {
            return await MatrixClientPeg.get().getThirdpartyUser(PROTOCOL_SIP_VIRTUAL, {
                native_mxid: nativeMxid,
            });
        } catch (e) {
            logger.warn("Failed to query SIP identity for user", e);
            return Promise.resolve([]);
        }
    }

    public async sipNativeLookup(virtualMxid: string): Promise<ThirdpartyLookupResponse[]> {
        try {
            return await MatrixClientPeg.get().getThirdpartyUser(PROTOCOL_SIP_NATIVE, {
                virtual_mxid: virtualMxid,
            });
        } catch (e) {
            logger.warn("Failed to query identity for SIP user", e);
            return Promise.resolve([]);
        }
    }

    private onCallIncoming = (call: MatrixCall): void => {
        // if the runtime env doesn't do VoIP, stop here.
        if (!MatrixClientPeg.get().supportsVoip()) {
            return;
        }

        const mappedRoomId = LegacyCallHandler.instance.roomIdForCall(call);
        if (!mappedRoomId) return;
        if (this.getCallForRoom(mappedRoomId)) {
            logger.log(
                "Got incoming call for room " + mappedRoomId + " but there's already a call for this room: ignoring",
            );
            return;
        }

        this.addCallForRoom(mappedRoomId, call);
        this.setCallListeners(call);
        // Explicitly handle first state change
        this.onCallStateChanged(call.state, null, call);

        // get ready to send encrypted events in the room, so if the user does answer
        // the call, we'll be ready to send. NB. This is the protocol-level room ID not
        // the mapped one: that's where we'll send the events.
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(call.roomId);
        if (room) cli.prepareToEncrypt(room);
    };

    public getCallById(callId: string): MatrixCall | null {
        for (const call of this.calls.values()) {
            if (call.callId === callId) return call;
        }
        return null;
    }

    public getCallForRoom(roomId: string): MatrixCall | null {
        return this.calls.get(roomId) || null;
    }

    public getAnyActiveCall(): MatrixCall | null {
        for (const call of this.calls.values()) {
            if (call.state !== CallState.Ended) {
                return call;
            }
        }
        return null;
    }

    public getAllActiveCalls(): MatrixCall[] {
        const activeCalls: MatrixCall[] = [];

        for (const call of this.calls.values()) {
            if (call.state !== CallState.Ended && call.state !== CallState.Ringing) {
                activeCalls.push(call);
            }
        }
        return activeCalls;
    }

    public getAllActiveCallsNotInRoom(notInThisRoomId: string): MatrixCall[] {
        const callsNotInThatRoom: MatrixCall[] = [];

        for (const [roomId, call] of this.calls.entries()) {
            if (roomId !== notInThisRoomId && call.state !== CallState.Ended) {
                callsNotInThatRoom.push(call);
            }
        }
        return callsNotInThatRoom;
    }

    public getAllActiveCallsForPip(roomId: string): MatrixCall[] {
        const room = MatrixClientPeg.get().getRoom(roomId);
        if (room && WidgetLayoutStore.instance.hasMaximisedWidget(room)) {
            // This checks if there is space for the call view in the aux panel
            // If there is no space any call should be displayed in PiP
            return this.getAllActiveCalls();
        }
        return this.getAllActiveCallsNotInRoom(roomId);
    }

    public getTransfereeForCallId(callId: string): MatrixCall | undefined {
        return this.transferees.get(callId);
    }

    public play(audioId: AudioID): void {
        const logPrefix = `LegacyCallHandler.play(${audioId}):`;
        logger.debug(`${logPrefix} beginning of function`);
        // TODO: Attach an invisible element for this instead
        // which listens?
        const audio = document.getElementById(audioId) as HTMLMediaElement;
        if (audio) {
            this.addEventListenersForAudioElement(audio);
            const playAudio = async (): Promise<void> => {
                try {
                    if (audio.muted) {
                        logger.error(
                            `${logPrefix} <audio> element was unexpectedly muted but we recovered ` +
                                `gracefully by unmuting it`,
                        );
                        // Recover gracefully
                        audio.muted = false;
                    }

                    // This still causes the chrome debugger to break on promise rejection if
                    // the promise is rejected, even though we're catching the exception.
                    logger.debug(`${logPrefix} attempting to play audio at volume=${audio.volume}`);
                    await audio.play();
                    logger.debug(`${logPrefix} playing audio successfully`);
                } catch (e) {
                    // This is usually because the user hasn't interacted with the document,
                    // or chrome doesn't think so and is denying the request. Not sure what
                    // we can really do here...
                    // https://github.com/vector-im/element-web/issues/7657
                    logger.warn(`${logPrefix} unable to play audio clip`, e);
                }
            };
            if (this.audioPromises.has(audioId)) {
                this.audioPromises.set(
                    audioId,
                    this.audioPromises.get(audioId)!.then(() => {
                        audio.load();
                        return playAudio();
                    }),
                );
            } else {
                this.audioPromises.set(audioId, playAudio());
            }
        } else {
            logger.warn(`${logPrefix} unable to find <audio> element for ${audioId}`);
        }
    }

    public pause(audioId: AudioID): void {
        const logPrefix = `LegacyCallHandler.pause(${audioId}):`;
        logger.debug(`${logPrefix} beginning of function`);
        // TODO: Attach an invisible element for this instead
        // which listens?
        const audio = document.getElementById(audioId) as HTMLMediaElement;
        const pauseAudio = (): void => {
            logger.debug(`${logPrefix} pausing audio`);
            // pause doesn't return a promise, so just do it
            audio.pause();
        };
        if (audio) {
            if (this.audioPromises.has(audioId)) {
                this.audioPromises.set(audioId, this.audioPromises.get(audioId)!.then(pauseAudio));
            } else {
                pauseAudio();
            }
        } else {
            logger.warn(`${logPrefix} unable to find <audio> element for ${audioId}`);
        }
    }

    private matchesCallForThisRoom(call: MatrixCall): boolean {
        // We don't allow placing more than one call per room, but that doesn't mean there
        // can't be more than one, eg. in a glare situation. This checks that the given call
        // is the call we consider 'the' call for its room.
        const mappedRoomId = this.roomIdForCall(call);

        const callForThisRoom = mappedRoomId ? this.getCallForRoom(mappedRoomId) : null;
        return !!callForThisRoom && call.callId === callForThisRoom.callId;
    }

    private setCallListeners(call: MatrixCall): void {
        let mappedRoomId = this.roomIdForCall(call);

        call.on(CallEvent.Error, (err: CallError) => {
            if (!this.matchesCallForThisRoom(call)) return;

            logger.error("Call error:", err);

            if (err.code === CallErrorCode.NoUserMedia) {
                this.showMediaCaptureError(call);
                return;
            }

            if (
                MatrixClientPeg.get().getTurnServers().length === 0 &&
                SettingsStore.getValue("fallbackICEServerAllowed") === null
            ) {
                this.showICEFallbackPrompt();
                return;
            }

            Modal.createDialog(ErrorDialog, {
                title: _t("Call Failed"),
                description: err.message,
            });
        });
        call.on(CallEvent.Hangup, () => {
            if (!mappedRoomId || !this.matchesCallForThisRoom(call)) return;

            if (isNotNull(mappedRoomId)) {
                this.removeCallForRoom(mappedRoomId);
            }
        });
        call.on(CallEvent.State, (newState: CallState, oldState: CallState) => {
            this.onCallStateChanged(newState, oldState, call);
        });
        call.on(CallEvent.Replaced, (newCall: MatrixCall) => {
            if (!mappedRoomId || !this.matchesCallForThisRoom(call)) return;

            logger.log(`Call ID ${call.callId} is being replaced by call ID ${newCall.callId}`);

            if (call.state === CallState.Ringing) {
                this.pause(AudioID.Ring);
            } else if (call.state === CallState.InviteSent) {
                this.pause(AudioID.Ringback);
            }

            if (isNotNull(mappedRoomId)) {
                this.removeCallForRoom(mappedRoomId);
                this.addCallForRoom(mappedRoomId, newCall);
            }
            this.setCallListeners(newCall);
            this.setCallState(newCall, newCall.state);
        });
        call.on(CallEvent.AssertedIdentityChanged, async (): Promise<void> => {
            if (!mappedRoomId || !this.matchesCallForThisRoom(call)) return;

            logger.log(`Call ID ${call.callId} got new asserted identity:`, call.getRemoteAssertedIdentity());

            if (!this.shouldObeyAssertedfIdentity()) {
                logger.log("asserted identity not enabled in config: ignoring");
                return;
            }

            const newAssertedIdentity = call.getRemoteAssertedIdentity()?.id;
            let newNativeAssertedIdentity = newAssertedIdentity;
            if (newAssertedIdentity) {
                const response = await this.sipNativeLookup(newAssertedIdentity);
                if (response.length && response[0].fields.lookup_success) {
                    newNativeAssertedIdentity = response[0].userid;
                }
            }
            logger.log(`Asserted identity ${newAssertedIdentity} mapped to ${newNativeAssertedIdentity}`);

            if (newNativeAssertedIdentity) {
                this.assertedIdentityNativeUsers.set(call.callId, newNativeAssertedIdentity);

                // If we don't already have a room with this user, make one. This will be slightly odd
                // if they called us because we'll be inviting them, but there's not much we can do about
                // this if we want the actual, native room to exist (which we do). This is why it's
                // important to only obey asserted identity in trusted environments, since anyone you're
                // on a call with can cause you to send a room invite to someone.
                await ensureDMExists(MatrixClientPeg.get(), newNativeAssertedIdentity);

                const newMappedRoomId = this.roomIdForCall(call);
                logger.log(`Old room ID: ${mappedRoomId}, new room ID: ${newMappedRoomId}`);
                if (newMappedRoomId !== mappedRoomId && isNotNull(mappedRoomId) && isNotNull(newMappedRoomId)) {
                    this.removeCallForRoom(mappedRoomId);
                    mappedRoomId = newMappedRoomId;
                    logger.log("Moving call to room " + mappedRoomId);
                    this.addCallForRoom(mappedRoomId, call, true);
                }
            }
        });
    }

    private onCallStateChanged = (newState: CallState, oldState: CallState | null, call: MatrixCall): void => {
        const mappedRoomId = this.roomIdForCall(call);
        if (!mappedRoomId || !this.matchesCallForThisRoom(call)) return;

        this.setCallState(call, newState);
        dis.dispatch({
            action: "call_state",
            room_id: mappedRoomId,
            state: newState,
        });

        switch (oldState) {
            case CallState.Ringing:
                this.pause(AudioID.Ring);
                break;
            case CallState.InviteSent:
                this.pause(AudioID.Ringback);
                break;
        }

        if (newState !== CallState.Ringing) {
            this.silencedCalls.delete(call.callId);
        }

        switch (newState) {
            case CallState.Ringing: {
                const incomingCallPushRule = new PushProcessor(MatrixClientPeg.get()).getPushRuleById(
                    RuleId.IncomingCall,
                );
                const pushRuleEnabled = incomingCallPushRule?.enabled;
                // actions can be either Tweaks | PushRuleActionName, ie an object or a string type enum
                // and we want to only run this check on the Tweaks
                const tweakSetToRing = incomingCallPushRule?.actions.some(
                    (action) =>
                        typeof action !== "string" && action.set_tweak === TweakName.Sound && action.value === "ring",
                );

                if (pushRuleEnabled && tweakSetToRing && !this.isForcedSilent()) {
                    this.play(AudioID.Ring);
                } else {
                    this.silenceCall(call.callId);
                }
                break;
            }
            case CallState.InviteSent: {
                this.play(AudioID.Ringback);
                break;
            }
            case CallState.Ended: {
                const hangupReason = call.hangupReason;
                if (isNotNull(mappedRoomId)) {
                    this.removeCallForRoom(mappedRoomId);
                }

                if (oldState === CallState.InviteSent && call.hangupParty === CallParty.Remote) {
                    this.play(AudioID.Busy);

                    // Don't show a modal when we got rejected/the call was hung up
                    if (!hangupReason || [CallErrorCode.UserHangup, "user hangup"].includes(hangupReason)) break;

                    let title: string;
                    let description: string;
                    // TODO: We should either do away with these or figure out a copy for each code (expect user_hangup...)
                    if (call.hangupReason === CallErrorCode.UserBusy) {
                        title = _t("User Busy");
                        description = _t("The user you called is busy.");
                    } else {
                        title = _t("Call Failed");
                        description = _t("The call could not be established");
                    }

                    Modal.createDialog(ErrorDialog, {
                        title,
                        description,
                    });
                } else if (hangupReason === CallErrorCode.AnsweredElsewhere && oldState === CallState.Connecting) {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Answered Elsewhere"),
                        description: _t("The call was answered on another device."),
                    });
                } else if (oldState !== CallState.Fledgling && oldState !== CallState.Ringing) {
                    // don't play the end-call sound for calls that never got off the ground
                    this.play(AudioID.CallEnd);
                }

                if (isNotNull(mappedRoomId)) {
                    this.logCallStats(call, mappedRoomId);
                }
                break;
            }
        }
    };

    private async logCallStats(call: MatrixCall, mappedRoomId: string): Promise<void> {
        const stats = await call.getCurrentCallStats();
        logger.debug(
            `Call completed. Call ID: ${call.callId}, virtual room ID: ${call.roomId}, ` +
                `user-facing room ID: ${mappedRoomId}, direction: ${call.direction}, ` +
                `our Party ID: ${call.ourPartyId}, hangup party: ${call.hangupParty}, ` +
                `hangup reason: ${call.hangupReason}`,
        );
        if (!stats) {
            logger.debug(
                "Call statistics are undefined. The call has probably failed before a peerConn was established",
            );
            return;
        }
        logger.debug("Local candidates:");
        for (const cand of stats.filter((item) => item.type === "local-candidate")) {
            const address = cand.address || cand.ip; // firefox uses 'address', chrome uses 'ip'
            logger.debug(
                `${cand.id} - type: ${cand.candidateType}, address: ${address}, port: ${cand.port}, ` +
                    `protocol: ${cand.protocol}, relay protocol: ${cand.relayProtocol}, network type: ${cand.networkType}`,
            );
        }
        logger.debug("Remote candidates:");
        for (const cand of stats.filter((item) => item.type === "remote-candidate")) {
            const address = cand.address || cand.ip; // firefox uses 'address', chrome uses 'ip'
            logger.debug(
                `${cand.id} - type: ${cand.candidateType}, address: ${address}, port: ${cand.port}, ` +
                    `protocol: ${cand.protocol}`,
            );
        }
        logger.debug("Candidate pairs:");
        for (const pair of stats.filter((item) => item.type === "candidate-pair")) {
            logger.debug(
                `${pair.localCandidateId} / ${pair.remoteCandidateId} - state: ${pair.state}, ` +
                    `nominated: ${pair.nominated}, ` +
                    `requests sent ${pair.requestsSent}, requests received  ${pair.requestsReceived},  ` +
                    `responses received: ${pair.responsesReceived}, responses sent: ${pair.responsesSent}, ` +
                    `bytes received: ${pair.bytesReceived}, bytes sent: ${pair.bytesSent}, `,
            );
        }

        logger.debug("Outbound RTP:");
        for (const s of stats.filter((item) => item.type === "outbound-rtp")) {
            logger.debug(s);
        }

        logger.debug("Inbound RTP:");
        for (const s of stats.filter((item) => item.type === "inbound-rtp")) {
            logger.debug(s);
        }
    }

    private setCallState(call: MatrixCall, status: CallState): void {
        const mappedRoomId = LegacyCallHandler.instance.roomIdForCall(call);

        logger.log(`Call state in ${mappedRoomId} changed to ${status}`);

        const toastKey = getIncomingLegacyCallToastKey(call.callId);
        if (status === CallState.Ringing) {
            ToastStore.sharedInstance().addOrReplaceToast({
                key: toastKey,
                priority: 100,
                component: IncomingLegacyCallToast,
                bodyClassName: "mx_IncomingLegacyCallToast",
                props: { call },
            });
        } else {
            ToastStore.sharedInstance().dismissToast(toastKey);
        }

        this.emit(LegacyCallHandlerEvent.CallState, mappedRoomId, status);
    }

    private removeCallForRoom(roomId: string): void {
        logger.log("Removing call for room ", roomId);
        this.calls.delete(roomId);
        this.emit(LegacyCallHandlerEvent.CallsChanged, this.calls);
    }

    private showICEFallbackPrompt(): void {
        const cli = MatrixClientPeg.get();
        Modal.createDialog(
            QuestionDialog,
            {
                title: _t("Call failed due to misconfigured server"),
                description: (
                    <div>
                        <p>
                            {_t(
                                "Please ask the administrator of your homeserver " +
                                    "(<code>%(homeserverDomain)s</code>) to configure a TURN server in " +
                                    "order for calls to work reliably.",
                                { homeserverDomain: cli.getDomain() },
                                { code: (sub: string) => <code>{sub}</code> },
                            )}
                        </p>
                        <p>
                            {_t(
                                "Alternatively, you can try to use the public server at " +
                                    "<server/>, but this will not be as reliable, and " +
                                    "it will share your IP address with that server. You can also manage " +
                                    "this in Settings.",
                                undefined,
                                { server: () => <code>{new URL(FALLBACK_ICE_SERVER).pathname}</code> },
                            )}
                        </p>
                    </div>
                ),
                button: _t("Try using %(server)s", {
                    server: new URL(FALLBACK_ICE_SERVER).pathname,
                }),
                cancelButton: _t("OK"),
                onFinished: (allow) => {
                    SettingsStore.setValue("fallbackICEServerAllowed", null, SettingLevel.DEVICE, allow);
                    cli.setFallbackICEServerAllowed(!!allow);
                },
            },
            undefined,
            true,
        );
    }

    private showMediaCaptureError(call: MatrixCall): void {
        let title;
        let description;

        if (call.type === CallType.Voice) {
            title = _t("Unable to access microphone");
            description = (
                <div>
                    {_t(
                        "Call failed because microphone could not be accessed. " +
                            "Check that a microphone is plugged in and set up correctly.",
                    )}
                </div>
            );
        } else if (call.type === CallType.Video) {
            title = _t("Unable to access webcam / microphone");
            description = (
                <div>
                    {_t("Call failed because webcam or microphone could not be accessed. Check that:")}
                    <ul>
                        <li>{_t("A microphone and webcam are plugged in and set up correctly")}</li>
                        <li>{_t("Permission is granted to use the webcam")}</li>
                        <li>{_t("No other application is using the webcam")}</li>
                    </ul>
                </div>
            );
        }

        Modal.createDialog(
            ErrorDialog,
            {
                title,
                description,
            },
            undefined,
            true,
        );
    }

    private async placeMatrixCall(roomId: string, type: CallType, transferee?: MatrixCall): Promise<void> {
        const mappedRoomId = (await VoipUserMapper.sharedInstance().getOrCreateVirtualRoomForRoom(roomId)) || roomId;
        logger.debug("Mapped real room " + roomId + " to room ID " + mappedRoomId);

        // If we're using a virtual room nd there are any events pending, try to resend them,
        // otherwise the call will fail and because its a virtual room, the user won't be able
        // to see it to either retry or clear the pending events. There will only be call events
        // in this queue, and since we're about to place a new call, they can only be events from
        // previous calls that are probably stale by now, so just cancel them.
        if (mappedRoomId !== roomId) {
            const mappedRoom = MatrixClientPeg.get().getRoom(mappedRoomId);
            if (mappedRoom?.getPendingEvents().length) {
                Resend.cancelUnsentEvents(mappedRoom);
            }
        }

        const timeUntilTurnCresExpire = MatrixClientPeg.get().getTurnServersExpiry() - Date.now();
        logger.log("Current turn creds expire in " + timeUntilTurnCresExpire + " ms");
        const call = MatrixClientPeg.get().createCall(mappedRoomId)!;

        try {
            this.addCallForRoom(roomId, call);
        } catch (e) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Already in call"),
                description: _t("You're already in a call with this person."),
            });
            return;
        }
        if (transferee) {
            this.transferees.set(call.callId, transferee);
        }

        this.setCallListeners(call);

        this.setActiveCallRoomId(roomId);

        if (type === CallType.Voice) {
            call.placeVoiceCall();
        } else if (type === "video") {
            call.placeVideoCall();
        } else {
            logger.error("Unknown conf call type: " + type);
        }
    }

    public async placeCall(roomId: string, type: CallType, transferee?: MatrixCall): Promise<void> {
        // Pause current broadcast, if any
        SdkContextClass.instance.voiceBroadcastPlaybacksStore.getCurrent()?.pause();

        if (SdkContextClass.instance.voiceBroadcastRecordingsStore.getCurrent()) {
            // Do not start a call, if recording a broadcast
            showCantStartACallDialog();
            return;
        }

        // We might be using managed hybrid widgets
        if (isManagedHybridWidgetEnabled(roomId)) {
            await addManagedHybridWidget(roomId);
            return;
        }

        // if the runtime env doesn't do VoIP, whine.
        if (!MatrixClientPeg.get().supportsVoip()) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Calls are unsupported"),
                description: _t("You cannot place calls in this browser."),
            });
            return;
        }

        if (MatrixClientPeg.get().getSyncState() === SyncState.Error) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Connectivity to the server has been lost"),
                description: _t("You cannot place calls without a connection to the server."),
            });
            return;
        }

        // don't allow > 2 calls to be placed.
        if (this.getAllActiveCalls().length > 1) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Too Many Calls"),
                description: _t("You've reached the maximum number of simultaneous calls."),
            });
            return;
        }

        const room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) {
            logger.error(`Room ${roomId} does not exist.`);
            return;
        }

        // We leave the check for whether there's already a call in this room until later,
        // otherwise it can race.

        const members = getJoinedNonFunctionalMembers(room);
        if (members.length <= 1) {
            Modal.createDialog(ErrorDialog, {
                description: _t("You cannot place a call with yourself."),
            });
        } else if (members.length === 2) {
            logger.info(`Place ${type} call in ${roomId}`);

            await this.placeMatrixCall(roomId, type, transferee);
        } else {
            // > 2
            await this.placeJitsiCall(roomId, type);
        }
    }

    public hangupAllCalls(): void {
        for (const call of this.calls.values()) {
            this.stopRingingIfPossible(call.callId);
            call.hangup(CallErrorCode.UserHangup, false);
        }
    }

    public hangupOrReject(roomId: string, reject?: boolean): void {
        const call = this.calls.get(roomId);

        // no call to hangup
        if (!call) return;

        this.stopRingingIfPossible(call.callId);

        if (reject) {
            call.reject();
        } else {
            call.hangup(CallErrorCode.UserHangup, false);
        }
        // don't remove the call yet: let the hangup event handler do it (otherwise it will throw
        // the hangup event away)
    }

    public answerCall(roomId: string): void {
        // no call to answer
        if (!this.calls.has(roomId)) return;

        const call = this.calls.get(roomId)!;
        this.stopRingingIfPossible(call.callId);

        if (this.getAllActiveCalls().length > 1) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Too Many Calls"),
                description: _t("You've reached the maximum number of simultaneous calls."),
            });
            return;
        }

        call.answer();
        this.setActiveCallRoomId(roomId);
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "WebAcceptCall",
        });
    }

    private stopRingingIfPossible(callId: string): void {
        this.silencedCalls.delete(callId);
        if (this.areAnyCallsUnsilenced()) return;
        this.pause(AudioID.Ring);
    }

    public async dialNumber(number: string, transferee?: MatrixCall): Promise<void> {
        const results = await this.pstnLookup(number);
        if (!results || results.length === 0 || !results[0].userid) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Unable to look up phone number"),
                description: _t("There was an error looking up the phone number"),
            });
            return;
        }
        const userId = results[0].userid;

        // Now check to see if this is a virtual user, in which case we should find the
        // native user
        let nativeUserId;
        if (this.getSupportsVirtualRooms()) {
            const nativeLookupResults = await this.sipNativeLookup(userId);
            const lookupSuccess = nativeLookupResults.length > 0 && nativeLookupResults[0].fields.lookup_success;
            nativeUserId = lookupSuccess ? nativeLookupResults[0].userid : userId;
            logger.log("Looked up " + number + " to " + userId + " and mapped to native user " + nativeUserId);
        } else {
            nativeUserId = userId;
        }

        const roomId = await ensureDMExists(MatrixClientPeg.get(), nativeUserId);
        if (!roomId) {
            throw new Error("Failed to ensure DM exists for dialing number");
        }

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "WebDialPad",
        });

        await this.placeMatrixCall(roomId, CallType.Voice, transferee);
    }

    public async startTransferToPhoneNumber(
        call: MatrixCall,
        destination: string,
        consultFirst: boolean,
    ): Promise<void> {
        if (consultFirst) {
            // if we're consulting, we just start by placing a call to the transfer
            // target (passing the transferee so the actual transfer can happen later)
            this.dialNumber(destination, call);
            return;
        }

        const results = await this.pstnLookup(destination);
        if (!results || results.length === 0 || !results[0].userid) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Unable to transfer call"),
                description: _t("There was an error looking up the phone number"),
            });
            return;
        }

        await this.startTransferToMatrixID(call, results[0].userid, consultFirst);
    }

    public async startTransferToMatrixID(call: MatrixCall, destination: string, consultFirst: boolean): Promise<void> {
        if (consultFirst) {
            const dmRoomId = await ensureDMExists(MatrixClientPeg.get(), destination);
            if (!dmRoomId) {
                logger.log("Failed to transfer call, could not ensure dm exists");
                Modal.createDialog(ErrorDialog, {
                    title: _t("Transfer Failed"),
                    description: _t("Failed to transfer call"),
                });
                return;
            }

            this.placeCall(dmRoomId, call.type, call);
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: dmRoomId,
                should_peek: false,
                joining: false,
                metricsTrigger: undefined, // other
            });
        } else {
            try {
                await call.transfer(destination);
            } catch (e) {
                logger.log("Failed to transfer call", e);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Transfer Failed"),
                    description: _t("Failed to transfer call"),
                });
            }
        }
    }

    public setActiveCallRoomId(activeCallRoomId: string): void {
        logger.info("Setting call in room " + activeCallRoomId + " active");

        for (const [roomId, call] of this.calls.entries()) {
            if (call.state === CallState.Ended) continue;

            if (roomId === activeCallRoomId) {
                call.setRemoteOnHold(false);
            } else {
                logger.info("Holding call in room " + roomId + " because another call is being set active");
                call.setRemoteOnHold(true);
            }
        }
    }

    /**
     * @returns true if we are currently in any call where we haven't put the remote party on hold
     */
    public hasAnyUnheldCall(): boolean {
        for (const call of this.calls.values()) {
            if (call.state === CallState.Ended) continue;
            if (!call.isRemoteOnHold()) return true;
        }

        return false;
    }

    private async placeJitsiCall(roomId: string, type: CallType): Promise<void> {
        const client = MatrixClientPeg.get();
        logger.info(`Place conference call in ${roomId}`);

        dis.dispatch({ action: "appsDrawer", show: true });

        // Prevent double clicking the call button
        const widget = WidgetStore.instance.getApps(roomId).find((app) => WidgetType.JITSI.matches(app.type));
        if (widget) {
            // If there already is a Jitsi widget, pin it
            const room = client.getRoom(roomId);
            if (isNotNull(room)) {
                WidgetLayoutStore.instance.moveToContainer(room, widget, Container.Top);
            }
            return;
        }

        try {
            await WidgetUtils.addJitsiWidget(client, roomId, type, "Jitsi", false);
            logger.log("Jitsi widget added");
        } catch (e) {
            if (e instanceof MatrixError && e.errcode === "M_FORBIDDEN") {
                Modal.createDialog(ErrorDialog, {
                    title: _t("Permission Required"),
                    description: _t("You do not have permission to start a conference call in this room"),
                });
            }
            logger.error(e);
        }
    }

    public hangupCallApp(roomId: string): void {
        logger.info("Leaving conference call in " + roomId);

        const roomInfo = WidgetStore.instance.getRoom(roomId);
        if (!roomInfo) return; // "should never happen" clauses go here

        const jitsiWidgets = roomInfo.widgets.filter((w) => WidgetType.JITSI.matches(w.type));
        jitsiWidgets.forEach((w) => {
            const messaging = WidgetMessagingStore.instance.getMessagingForUid(WidgetUtils.getWidgetUid(w));
            if (!messaging) return; // more "should never happen" words

            messaging.transport.send(ElementWidgetActions.HangupCall, {});
        });
    }

    /*
     * Shows the transfer dialog for a call, signalling to the other end that
     * a transfer is about to happen
     */
    public showTransferDialog(call: MatrixCall): void {
        call.setRemoteOnHold(true);
        dis.dispatch<OpenInviteDialogPayload>({
            action: Action.OpenInviteDialog,
            kind: InviteKind.CallTransfer,
            call,
            analyticsName: "Transfer Call",
            className: "mx_InviteDialog_transferWrapper",
            onFinishedCallback: (results) => {
                if (results.length === 0 || results[0] === false) {
                    call.setRemoteOnHold(false);
                }
            },
        });
    }

    private addCallForRoom(roomId: string, call: MatrixCall, changedRooms = false): void {
        if (this.calls.has(roomId)) {
            logger.log(`Couldn't add call to room ${roomId}: already have a call for this room`);
            throw new Error("Already have a call for room " + roomId);
        }

        logger.log("setting call for room " + roomId);
        this.calls.set(roomId, call);

        // Should we always emit CallsChanged too?
        if (changedRooms) {
            this.emit(LegacyCallHandlerEvent.CallChangeRoom, call);
        } else {
            this.emit(LegacyCallHandlerEvent.CallsChanged, this.calls);
        }
    }
}
