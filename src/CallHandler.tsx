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
// @ts-ignore - XXX: tsc doesn't like this: our js-sdk imports are complex so this isn't surprising
import Matrix from 'matrix-js-sdk';
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
import { MatrixCall, CallErrorCode, CallState, CallType } from "matrix-js-sdk/lib/webrtc/call";

enum AudioID {
    Ring = 'ringAudio',
    Ringback = 'ringbackAudio',
    CallEnd = 'callendAudio',
    Busy = 'busyAudio',
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

    constructor() {
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
    }

    getCallForRoom(roomId: string): MatrixCall {
        return this.calls.get(roomId) || null;
    }

    getAnyActiveCall() {
        for (const call of this.calls.values()) {
            if (call.state !== "ended") {
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

    private setCallListeners(call: MatrixCall) {
        call.on("error", (err) => {
            console.error("Call error:", err);
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
        call.on("hangup", () => {
            this.removeCallForRoom(call.roomId);
        });
        // map web rtc states to dummy UI state
        // ringing|ringback|connected|ended|busy|stop_ringback|stop_ringing
        call.on("state", (newState: CallState, oldState: CallState) => {
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
                    this.removeCallForRoom(call.roomId);
                    if (oldState === CallState.InviteSent && (
                        call.hangupParty === "remote" ||
                        (call.hangupParty === "local" && call.hangupReason === "invite_timeout")
                    )) {
                        this.play(AudioID.Busy);
                        Modal.createTrackedDialog('Call Handler', 'Call Timeout', ErrorDialog, {
                            title: _t('Call Timeout'),
                            description: _t('The remote side failed to pick up') + '.',
                        });
                    } else {
                        this.play(AudioID.CallEnd);
                    }
            }
        });
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


    private placeCall(roomId: string, type: CallType, localElement: HTMLVideoElement, remoteElement: HTMLVideoElement) {
        const call = Matrix.createNewMatrixCall(MatrixClientPeg.get(), roomId);
        this.calls.set(roomId, call);
        this.setCallListeners(call);
        if (type === 'voice') {
            call.placeVoiceCall();
        } else if (type === 'video') {
            call.placeVideoCall(
                remoteElement,
                localElement,
            );
        } else if (type === 'screensharing') {
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
                    this.calls.set(call.roomId, call)
                    this.setCallListeners(call);
                }
                break;
            case 'hangup':
                if (!this.calls.get(payload.room_id)) {
                    return; // no call to hangup
                }
                this.calls.get(payload.room_id).hangup(CallErrorCode.UserHangup, false)
                this.removeCallForRoom(payload.room_id);
                break;
            case 'answer':
                if (!this.calls.has(payload.room_id)) {
                    return; // no call to answer
                }
                this.calls.get(payload.room_id).answer();
                dis.dispatch({
                    action: "view_room",
                    room_id: payload.room_id,
                });
                break;
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
