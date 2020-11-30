/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd
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

/*
 * Manages a list of all the currently active calls.
 *
 * This handler dispatches when voip calls are added/updated/removed from this list:
 * {
 *   action: 'call_state'
 *   room_id: <room ID of the call>
 * }
 *
 * To know the state of the call, this handler exposes a getter to
 * obtain the call for a room:
 *   var call = CallHandler.getCall(roomId)
 *   var state = call.call_state; // ringing|ringback|connected|ended|busy|stop_ringback|stop_ringing
 *
 * This handler listens for and handles the following actions:
 * {
 *   action: 'place_call',
 *   type: 'voice|video',
 *   room_id: <room that the place call button was pressed in>
 * }
 *
 * {
 *   action: 'incoming_call'
 *   call: MatrixCall
 * }
 *
 * {
 *   action: 'hangup'
 *   room_id: <room that the hangup button was pressed in>
 * }
 *
 * {
 *   action: 'answer'
 *   room_id: <room that the answer button was pressed in>
 * }
 */

import React from 'react';

import {MatrixClientPeg} from './MatrixClientPeg';
import PlatformPeg from './PlatformPeg';
import Modal from './Modal';
import { _t } from './languageHandler';
import { createNewMatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import dis from './dispatcher/dispatcher';
import WidgetUtils from './utils/WidgetUtils';
import WidgetEchoStore from './stores/WidgetEchoStore';
import SettingsStore from './settings/SettingsStore';
import {generateHumanReadableId} from "./utils/NamingUtils";
import {Jitsi} from "./widgets/Jitsi";
import {WidgetType} from "./widgets/WidgetType";
import {SettingLevel} from "./settings/SettingLevel";
import { ActionPayload } from "./dispatcher/payloads";
import {base32} from "rfc4648";

import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import WidgetStore from "./stores/WidgetStore";
import { WidgetMessagingStore } from "./stores/widgets/WidgetMessagingStore";
import { ElementWidgetActions } from "./stores/widgets/ElementWidgetActions";
import { MatrixCall, CallErrorCode, CallState, CallEvent, CallParty, CallType } from "matrix-js-sdk/src/webrtc/call";
import Analytics from './Analytics';
import CountlyAnalytics from "./CountlyAnalytics";
import {UIFeature} from "./settings/UIFeature";
import { CallError } from "matrix-js-sdk/src/webrtc/call";

enum AudioID {
    Ring = 'ringAudio',
    Ringback = 'ringbackAudio',
    CallEnd = 'callendAudio',
    Busy = 'busyAudio',
}

// Unlike 'CallType' in js-sdk, this one includes screen sharing
// (because a screen sharing call is only a screen sharing call to the caller,
// to the callee it's just a video call, at least as far as the current impl
// is concerned).
export enum PlaceCallType {
    Voice = 'voice',
    Video = 'video',
    ScreenSharing = 'screensharing',
}

function getRemoteAudioElement(): HTMLAudioElement {
    // this needs to be somewhere at the top of the DOM which
    // always exists to avoid audio interruptions.
    // Might as well just use DOM.
    const remoteAudioElement = document.getElementById("remoteAudio") as HTMLAudioElement;
    if (!remoteAudioElement) {
        console.error(
            "Failed to find remoteAudio element - cannot play audio!" +
            "You need to add an <audio/> to the DOM.",
        );
        return null;
    }
    return remoteAudioElement;
}

export default class CallHandler {
    private calls = new Map<string, MatrixCall>();
    private audioPromises = new Map<AudioID, Promise<void>>();

    static sharedInstance() {
        if (!window.mxCallHandler) {
            window.mxCallHandler = new CallHandler()
        }

        return window.mxCallHandler;
    }

    start() {
        dis.register(this.onAction);
        // add empty handlers for media actions, otherwise the media keys
        // end up causing the audio elements with our ring/ringback etc
        // audio clips in to play.
        if (navigator.mediaSession) {
            navigator.mediaSession.setActionHandler('play', function() {});
            navigator.mediaSession.setActionHandler('pause', function() {});
            navigator.mediaSession.setActionHandler('seekbackward', function() {});
            navigator.mediaSession.setActionHandler('seekforward', function() {});
            navigator.mediaSession.setActionHandler('previoustrack', function() {});
            navigator.mediaSession.setActionHandler('nexttrack', function() {});
        }

        if (SettingsStore.getValue(UIFeature.Voip)) {
            MatrixClientPeg.get().on('Call.incoming', this.onCallIncoming);
        }
    }

    stop() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener('Call.incoming', this.onCallIncoming);
        }
    }

    private onCallIncoming = (call) => {
        // we dispatch this synchronously to make sure that the event
        // handlers on the call are set up immediately (so that if
        // we get an immediate hangup, we don't get a stuck call)
        dis.dispatch({
            action: 'incoming_call',
            call: call,
        }, true);
    }

    getCallForRoom(roomId: string): MatrixCall {
        return this.calls.get(roomId) || null;
    }

    getAnyActiveCall() {
        for (const call of this.calls.values()) {
            if (call.state !== CallState.Ended) {
                return call;
            }
        }
        return null;
    }

    play(audioId: AudioID) {
        // TODO: Attach an invisible element for this instead
        // which listens?
        const audio = document.getElementById(audioId) as HTMLMediaElement;
        if (audio) {
            const playAudio = async () => {
                try {
                    // This still causes the chrome debugger to break on promise rejection if
                    // the promise is rejected, even though we're catching the exception.
                    await audio.play();
                } catch (e) {
                    // This is usually because the user hasn't interacted with the document,
                    // or chrome doesn't think so and is denying the request. Not sure what
                    // we can really do here...
                    // https://github.com/vector-im/element-web/issues/7657
                    console.log("Unable to play audio clip", e);
                }
            };
            if (this.audioPromises.has(audioId)) {
                this.audioPromises.set(audioId, this.audioPromises.get(audioId).then(() => {
                    audio.load();
                    return playAudio();
                }));
            } else {
                this.audioPromises.set(audioId, playAudio());
            }
        }
    }

    pause(audioId: AudioID) {
        // TODO: Attach an invisible element for this instead
        // which listens?
        const audio = document.getElementById(audioId) as HTMLMediaElement;
        if (audio) {
            if (this.audioPromises.has(audioId)) {
                this.audioPromises.set(audioId, this.audioPromises.get(audioId).then(() => audio.pause()));
            } else {
                // pause doesn't return a promise, so just do it
                audio.pause();
            }
        }
    }

    private matchesCallForThisRoom(call: MatrixCall) {
        // We don't allow placing more than one call per room, but that doesn't mean there
        // can't be more than one, eg. in a glare situation. This checks that the given call
        // is the call we consider 'the' call for its room.
        const callForThisRoom = this.getCallForRoom(call.roomId);
        return callForThisRoom && call.callId === callForThisRoom.callId;
    }

    private setCallListeners(call: MatrixCall) {
        call.on(CallEvent.Error, (err: CallError) => {
            if (!this.matchesCallForThisRoom(call)) return;

            Analytics.trackEvent('voip', 'callError', 'error', err.toString());
            console.error("Call error:", err);

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

            Modal.createTrackedDialog('Call Failed', '', ErrorDialog, {
                title: _t('Call Failed'),
                description: err.message,
            });
        });
        call.on(CallEvent.Hangup, () => {
            if (!this.matchesCallForThisRoom(call)) return;

            Analytics.trackEvent('voip', 'callHangup');

            this.removeCallForRoom(call.roomId);
        });
        call.on(CallEvent.State, (newState: CallState, oldState: CallState) => {
            if (!this.matchesCallForThisRoom(call)) return;

            this.setCallState(call, newState);

            switch (oldState) {
                case CallState.Ringing:
                    this.pause(AudioID.Ring);
                    break;
                case CallState.InviteSent:
                    this.pause(AudioID.Ringback);
                    break;
            }

            switch (newState) {
                case CallState.Ringing:
                    this.play(AudioID.Ring);
                    break;
                case CallState.InviteSent:
                    this.play(AudioID.Ringback);
                    break;
                case CallState.Ended:
                    Analytics.trackEvent('voip', 'callEnded', 'hangupReason', call.hangupReason);
                    this.removeCallForRoom(call.roomId);
                    if (oldState === CallState.InviteSent && (
                        call.hangupParty === CallParty.Remote ||
                        (call.hangupParty === CallParty.Local && call.hangupReason === CallErrorCode.InviteTimeout)
                    )) {
                        this.play(AudioID.Busy);
                        let title;
                        let description;
                        if (call.hangupReason === CallErrorCode.UserHangup) {
                            title = _t("Call Declined");
                            description = _t("The other party declined the call.");
                        } else if (call.hangupReason === CallErrorCode.InviteTimeout) {
                            title = _t("Call Failed");
                            // XXX: full stop appended as some relic here, but these
                            // strings need proper input from design anyway, so let's
                            // not change this string until we have a proper one.
                            description = _t('The remote side failed to pick up') + '.';
                        } else {
                            title = _t("Call Failed");
                            description = _t("The call could not be established");
                        }

                        Modal.createTrackedDialog('Call Handler', 'Call Failed', ErrorDialog, {
                            title, description,
                        });
                    } else if (
                        call.hangupReason === CallErrorCode.AnsweredElsewhere && oldState === CallState.Connecting
                    ) {
                        Modal.createTrackedDialog('Call Handler', 'Call Failed', ErrorDialog, {
                            title: _t("Answered Elsewhere"),
                            description: _t("The call was answered on another device."),
                        });
                    } else {
                        this.play(AudioID.CallEnd);
                    }
            }
        });
        call.on(CallEvent.Replaced, (newCall: MatrixCall) => {
            if (!this.matchesCallForThisRoom(call)) return;

            console.log(`Call ID ${call.callId} is being replaced by call ID ${newCall.callId}`);

            if (call.state === CallState.Ringing) {
                this.pause(AudioID.Ring);
            } else if (call.state === CallState.InviteSent) {
                this.pause(AudioID.Ringback);
            }

            this.calls.set(newCall.roomId, newCall);
            this.setCallListeners(newCall);
            this.setCallState(newCall, newCall.state);
        });
    }

    private setCallAudioElement(call: MatrixCall) {
        const audioElement = getRemoteAudioElement();
        if (audioElement) call.setRemoteAudioElement(audioElement);
    }

    private setCallState(call: MatrixCall, status: CallState) {
        console.log(
            `Call state in ${call.roomId} changed to ${status}`,
        );

        dis.dispatch({
            action: 'call_state',
            room_id: call.roomId,
            state: status,
        });
    }

    private removeCallForRoom(roomId: string) {
        this.calls.delete(roomId);
    }

    private showICEFallbackPrompt() {
        const cli = MatrixClientPeg.get();
        const code = sub => <code>{sub}</code>;
        Modal.createTrackedDialog('No TURN servers', '', QuestionDialog, {
            title: _t("Call failed due to misconfigured server"),
            description: <div>
                <p>{_t(
                    "Please ask the administrator of your homeserver " +
                    "(<code>%(homeserverDomain)s</code>) to configure a TURN server in " +
                    "order for calls to work reliably.",
                    { homeserverDomain: cli.getDomain() }, { code },
                )}</p>
                <p>{_t(
                    "Alternatively, you can try to use the public server at " +
                    "<code>turn.matrix.org</code>, but this will not be as reliable, and " +
                    "it will share your IP address with that server. You can also manage " +
                    "this in Settings.",
                    null, { code },
                )}</p>
            </div>,
            button: _t('Try using turn.matrix.org'),
            cancelButton: _t('OK'),
            onFinished: (allow) => {
                SettingsStore.setValue("fallbackICEServerAllowed", null, SettingLevel.DEVICE, allow);
                cli.setFallbackICEServerAllowed(allow);
            },
        }, null, true);
    }

    private showMediaCaptureError(call: MatrixCall) {
        let title;
        let description;

        if (call.type === CallType.Voice) {
            title = _t("Unable to access microphone");
            description = <div>
                {_t(
                    "Call failed because no microphone could not be accessed. " +
                    "Check that a microphone is plugged in and set up correctly.",
                )}
            </div>;
        } else if (call.type === CallType.Video) {
            title = _t("Unable to access webcam / microphone");
            description = <div>
                {_t("Call failed because no webcam or microphone could not be accessed. Check that:")}
                <ul>
                    <li>{_t("A microphone and webcam are plugged in and set up correctly")}</li>
                    <li>{_t("Permission is granted to use the webcam")}</li>
                    <li>{_t("No other application is using the webcam")}</li>
                </ul>
            </div>;
        }

        Modal.createTrackedDialog('Media capture failed', '', ErrorDialog, {
            title, description,
        }, null, true);
    }

    private placeCall(
        roomId: string, type: PlaceCallType,
        localElement: HTMLVideoElement, remoteElement: HTMLVideoElement,
    ) {
        Analytics.trackEvent('voip', 'placeCall', 'type', type);
        CountlyAnalytics.instance.trackStartCall(roomId, type === PlaceCallType.Video, false);
        const call = createNewMatrixCall(MatrixClientPeg.get(), roomId);
        this.calls.set(roomId, call);
        this.setCallListeners(call);
        this.setCallAudioElement(call);

        if (type === PlaceCallType.Voice) {
            call.placeVoiceCall();
        } else if (type === 'video') {
            call.placeVideoCall(
                remoteElement,
                localElement,
            );
        } else if (type === PlaceCallType.ScreenSharing) {
            const screenCapErrorString = PlatformPeg.get().screenCaptureErrorString();
            if (screenCapErrorString) {
                this.removeCallForRoom(roomId);
                console.log("Can't capture screen: " + screenCapErrorString);
                Modal.createTrackedDialog('Call Handler', 'Unable to capture screen', ErrorDialog, {
                    title: _t('Unable to capture screen'),
                    description: screenCapErrorString,
                });
                return;
            }
            call.placeScreenSharingCall(remoteElement, localElement);
        } else {
            console.error("Unknown conf call type: %s", type);
        }
    }

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case 'place_call':
                {
                    if (this.getAnyActiveCall()) {
                        Modal.createTrackedDialog('Call Handler', 'Existing Call', ErrorDialog, {
                            title: _t('Existing Call'),
                            description: _t('You are already in a call.'),
                        });
                        return; // don't allow >1 call to be placed.
                    }

                    // if the runtime env doesn't do VoIP, whine.
                    if (!MatrixClientPeg.get().supportsVoip()) {
                        Modal.createTrackedDialog('Call Handler', 'VoIP is unsupported', ErrorDialog, {
                            title: _t('VoIP is unsupported'),
                            description: _t('You cannot place VoIP calls in this browser.'),
                        });
                        return;
                    }

                    const room = MatrixClientPeg.get().getRoom(payload.room_id);
                    if (!room) {
                        console.error("Room %s does not exist.", payload.room_id);
                        return;
                    }

                    const members = room.getJoinedMembers();
                    if (members.length <= 1) {
                        Modal.createTrackedDialog('Call Handler', 'Cannot place call with self', ErrorDialog, {
                            description: _t('You cannot place a call with yourself.'),
                        });
                        return;
                    } else if (members.length === 2) {
                        console.info("Place %s call in %s", payload.type, payload.room_id);

                        this.placeCall(payload.room_id, payload.type, payload.local_element, payload.remote_element);
                    } else { // > 2
                        dis.dispatch({
                            action: "place_conference_call",
                            room_id: payload.room_id,
                            type: payload.type,
                            remote_element: payload.remote_element,
                            local_element: payload.local_element,
                        });
                    }
                }
                break;
            case 'place_conference_call':
                console.info("Place conference call in %s", payload.room_id);
                Analytics.trackEvent('voip', 'placeConferenceCall');
                CountlyAnalytics.instance.trackStartCall(payload.room_id, payload.type === PlaceCallType.Video, true);
                this.startCallApp(payload.room_id, payload.type);
                break;
            case 'end_conference':
                console.info("Terminating conference call in %s", payload.room_id);
                this.terminateCallApp(payload.room_id);
                break;
            case 'hangup_conference':
                console.info("Leaving conference call in %s", payload.room_id);
                this.hangupCallApp(payload.room_id);
                break;
            case 'incoming_call':
                {
                    if (this.getAnyActiveCall()) {
                        // ignore multiple incoming calls. in future, we may want a line-1/line-2 setup.
                        // we avoid rejecting with "busy" in case the user wants to answer it on a different device.
                        // in future we could signal a "local busy" as a warning to the caller.
                        // see https://github.com/vector-im/vector-web/issues/1964
                        return;
                    }

                    // if the runtime env doesn't do VoIP, stop here.
                    if (!MatrixClientPeg.get().supportsVoip()) {
                        return;
                    }

                    const call = payload.call as MatrixCall;
                    Analytics.trackEvent('voip', 'receiveCall', 'type', call.type);
                    this.calls.set(call.roomId, call)
                    this.setCallListeners(call);
                    this.setCallAudioElement(call);
                }
                break;
            case 'hangup':
            case 'reject':
                if (!this.calls.get(payload.room_id)) {
                    return; // no call to hangup
                }
                if (payload.action === 'reject') {
                    this.calls.get(payload.room_id).reject();
                } else {
                    this.calls.get(payload.room_id).hangup(CallErrorCode.UserHangup, false);
                }
                this.removeCallForRoom(payload.room_id);
                break;
            case 'answer': {
                if (!this.calls.has(payload.room_id)) {
                    return; // no call to answer
                }
                const call = this.calls.get(payload.room_id);
                call.answer();
                CountlyAnalytics.instance.trackJoinCall(payload.room_id, call.type === CallType.Video, false);
                dis.dispatch({
                    action: "view_room",
                    room_id: payload.room_id,
                });
                break;
            }
        }
    }

    private async startCallApp(roomId: string, type: string) {
        dis.dispatch({
            action: 'appsDrawer',
            show: true,
        });

        // prevent double clicking the call button
        const room = MatrixClientPeg.get().getRoom(roomId);
        const currentJitsiWidgets = WidgetUtils.getRoomWidgetsOfType(room, WidgetType.JITSI);
        const hasJitsi = currentJitsiWidgets.length > 0
            || WidgetEchoStore.roomHasPendingWidgetsOfType(roomId, currentJitsiWidgets, WidgetType.JITSI);
        if (hasJitsi) {
            Modal.createTrackedDialog('Call already in progress', '', ErrorDialog, {
                title: _t('Call in Progress'),
                description: _t('A call is currently being placed!'),
            });
            return;
        }

        const jitsiDomain = Jitsi.getInstance().preferredDomain;
        const jitsiAuth = await Jitsi.getInstance().getJitsiAuth();
        let confId;
        if (jitsiAuth === 'openidtoken-jwt') {
            // Create conference ID from room ID
            // For compatibility with Jitsi, use base32 without padding.
            // More details here:
            // https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
            confId = base32.stringify(Buffer.from(roomId), { pad: false });
        } else {
            // Create a random human readable conference ID
            confId = `JitsiConference${generateHumanReadableId()}`;
        }

        let widgetUrl = WidgetUtils.getLocalJitsiWrapperUrl({auth: jitsiAuth});

        // TODO: Remove URL hacks when the mobile clients eventually support v2 widgets
        const parsedUrl = new URL(widgetUrl);
        parsedUrl.search = ''; // set to empty string to make the URL class use searchParams instead
        parsedUrl.searchParams.set('confId', confId);
        widgetUrl = parsedUrl.toString();

        const widgetData = {
            conferenceId: confId,
            isAudioOnly: type === 'voice',
            domain: jitsiDomain,
            auth: jitsiAuth,
        };

        const widgetId = (
            'jitsi_' +
            MatrixClientPeg.get().credentials.userId +
            '_' +
            Date.now()
        );

        WidgetUtils.setRoomWidget(roomId, widgetId, WidgetType.JITSI, widgetUrl, 'Jitsi', widgetData).then(() => {
            console.log('Jitsi widget added');
        }).catch((e) => {
            if (e.errcode === 'M_FORBIDDEN') {
                Modal.createTrackedDialog('Call Failed', '', ErrorDialog, {
                    title: _t('Permission Required'),
                    description: _t("You do not have permission to start a conference call in this room"),
                });
            }
            console.error(e);
        });
    }

    private terminateCallApp(roomId: string) {
        Modal.createTrackedDialog('Confirm Jitsi Terminate', '', QuestionDialog, {
            hasCancelButton: true,
            title: _t("End conference"),
            description: _t("This will end the conference for everyone. Continue?"),
            button: _t("End conference"),
            onFinished: (proceed) => {
                if (!proceed) return;

                // We'll just obliterate them all. There should only ever be one, but might as well
                // be safe.
                const roomInfo = WidgetStore.instance.getRoom(roomId);
                const jitsiWidgets = roomInfo.widgets.filter(w => WidgetType.JITSI.matches(w.type));
                jitsiWidgets.forEach(w => {
                    // setting invalid content removes it
                    WidgetUtils.setRoomWidget(roomId, w.id);
                });
            },
        });
    }

    private hangupCallApp(roomId: string) {
        const roomInfo = WidgetStore.instance.getRoom(roomId);
        if (!roomInfo) return; // "should never happen" clauses go here

        const jitsiWidgets = roomInfo.widgets.filter(w => WidgetType.JITSI.matches(w.type));
        jitsiWidgets.forEach(w => {
            const messaging = WidgetMessagingStore.instance.getMessagingForId(w.id);
            if (!messaging) return; // more "should never happen" words

            messaging.transport.send(ElementWidgetActions.HangupCall, {});
        });
    }
}
