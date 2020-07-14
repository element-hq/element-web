/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd
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

import {MatrixClientPeg} from './MatrixClientPeg';
import PlatformPeg from './PlatformPeg';
import Modal from './Modal';
import * as sdk from './index';
import { _t } from './languageHandler';
import Matrix from 'matrix-js-sdk';
import dis from './dispatcher/dispatcher';
import WidgetUtils from './utils/WidgetUtils';
import WidgetEchoStore from './stores/WidgetEchoStore';
import SettingsStore, { SettingLevel } from './settings/SettingsStore';
import {generateHumanReadableId} from "./utils/NamingUtils";
import {Jitsi} from "./widgets/Jitsi";
import {WidgetType} from "./widgets/WidgetType";

global.mxCalls = {
    //room_id: MatrixCall
};
const calls = global.mxCalls;
let ConferenceHandler = null;

const audioPromises = {};

function play(audioId) {
    // TODO: Attach an invisible element for this instead
    // which listens?
    const audio = document.getElementById(audioId);
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
                // https://github.com/vector-im/riot-web/issues/7657
                console.log("Unable to play audio clip", e);
            }
        };
        if (audioPromises[audioId]) {
            audioPromises[audioId] = audioPromises[audioId].then(()=>{
                audio.load();
                return playAudio();
            });
        } else {
            audioPromises[audioId] = playAudio();
        }
    }
}

function pause(audioId) {
    // TODO: Attach an invisible element for this instead
    // which listens?
    const audio = document.getElementById(audioId);
    if (audio) {
        if (audioPromises[audioId]) {
            audioPromises[audioId] = audioPromises[audioId].then(()=>audio.pause());
        } else {
            // pause doesn't actually return a promise, but might as well do this for symmetry with play();
            audioPromises[audioId] = audio.pause();
        }
    }
}

function _setCallListeners(call) {
    call.on("error", function(err) {
        console.error("Call error:", err);
        if (
            MatrixClientPeg.get().getTurnServers().length === 0 &&
            SettingsStore.getValue("fallbackICEServerAllowed") === null
        ) {
            _showICEFallbackPrompt();
            return;
        }

        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createTrackedDialog('Call Failed', '', ErrorDialog, {
            title: _t('Call Failed'),
            description: err.message,
        });
    });
    call.on("hangup", function() {
        _setCallState(undefined, call.roomId, "ended");
    });
    // map web rtc states to dummy UI state
    // ringing|ringback|connected|ended|busy|stop_ringback|stop_ringing
    call.on("state", function(newState, oldState) {
        if (newState === "ringing") {
            _setCallState(call, call.roomId, "ringing");
            pause("ringbackAudio");
        } else if (newState === "invite_sent") {
            _setCallState(call, call.roomId, "ringback");
            play("ringbackAudio");
        } else if (newState === "ended" && oldState === "connected") {
            _setCallState(undefined, call.roomId, "ended");
            pause("ringbackAudio");
            play("callendAudio");
        } else if (newState === "ended" && oldState === "invite_sent" &&
                (call.hangupParty === "remote" ||
                (call.hangupParty === "local" && call.hangupReason === "invite_timeout")
                )) {
            _setCallState(call, call.roomId, "busy");
            pause("ringbackAudio");
            play("busyAudio");
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Call Handler', 'Call Timeout', ErrorDialog, {
                title: _t('Call Timeout'),
                description: _t('The remote side failed to pick up') + '.',
            });
        } else if (oldState === "invite_sent") {
            _setCallState(call, call.roomId, "stop_ringback");
            pause("ringbackAudio");
        } else if (oldState === "ringing") {
            _setCallState(call, call.roomId, "stop_ringing");
            pause("ringbackAudio");
        } else if (newState === "connected") {
            _setCallState(call, call.roomId, "connected");
            pause("ringbackAudio");
        }
    });
}

function _setCallState(call, roomId, status) {
    console.log(
        `Call state in ${roomId} changed to ${status} (${call ? call.call_state : "-"})`,
    );
    calls[roomId] = call;

    if (status === "ringing") {
        play("ringAudio");
    } else if (call && call.call_state === "ringing") {
        pause("ringAudio");
    }

    if (call) {
        call.call_state = status;
    }
    dis.dispatch({
        action: 'call_state',
        room_id: roomId,
        state: status,
    });
}

function _showICEFallbackPrompt() {
    const cli = MatrixClientPeg.get();
    const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
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

function _onAction(payload) {
    function placeCall(newCall) {
        _setCallListeners(newCall);
        if (payload.type === 'voice') {
            newCall.placeVoiceCall();
        } else if (payload.type === 'video') {
            newCall.placeVideoCall(
                payload.remote_element,
                payload.local_element,
            );
        } else if (payload.type === 'screensharing') {
            const screenCapErrorString = PlatformPeg.get().screenCaptureErrorString();
            if (screenCapErrorString) {
                _setCallState(undefined, newCall.roomId, "ended");
                console.log("Can't capture screen: " + screenCapErrorString);
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createTrackedDialog('Call Handler', 'Unable to capture screen', ErrorDialog, {
                    title: _t('Unable to capture screen'),
                    description: screenCapErrorString,
                });
                return;
            }
            newCall.placeScreenSharingCall(
                payload.remote_element,
                payload.local_element,
            );
        } else {
            console.error("Unknown conf call type: %s", payload.type);
        }
    }

    switch (payload.action) {
        case 'place_call':
            {
                if (callHandler.getAnyActiveCall()) {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Call Handler', 'Existing Call', ErrorDialog, {
                        title: _t('Existing Call'),
                        description: _t('You are already in a call.'),
                    });
                    return; // don't allow >1 call to be placed.
                }

                // if the runtime env doesn't do VoIP, whine.
                if (!MatrixClientPeg.get().supportsVoip()) {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
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
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    Modal.createTrackedDialog('Call Handler', 'Cannot place call with self', ErrorDialog, {
                        description: _t('You cannot place a call with yourself.'),
                    });
                    return;
                } else if (members.length === 2) {
                    console.info("Place %s call in %s", payload.type, payload.room_id);
                    const call = Matrix.createNewMatrixCall(MatrixClientPeg.get(), payload.room_id);
                    placeCall(call);
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
            _startCallApp(payload.room_id, payload.type);
            break;
        case 'incoming_call':
            {
                if (callHandler.getAnyActiveCall()) {
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

                const call = payload.call;
                _setCallListeners(call);
                _setCallState(call, call.roomId, "ringing");
            }
            break;
        case 'hangup':
            if (!calls[payload.room_id]) {
                return; // no call to hangup
            }
            calls[payload.room_id].hangup();
            _setCallState(null, payload.room_id, "ended");
            break;
        case 'answer':
            if (!calls[payload.room_id]) {
                return; // no call to answer
            }
            calls[payload.room_id].answer();
            _setCallState(calls[payload.room_id], payload.room_id, "connected");
            dis.dispatch({
                action: "view_room",
                room_id: payload.room_id,
            });
            break;
    }
}

async function _startCallApp(roomId, type) {
    dis.dispatch({
        action: 'appsDrawer',
        show: true,
    });

    const room = MatrixClientPeg.get().getRoom(roomId);
    const currentJitsiWidgets = WidgetUtils.getRoomWidgetsOfType(room, WidgetType.JITSI);

    if (WidgetEchoStore.roomHasPendingWidgetsOfType(roomId, currentJitsiWidgets, WidgetType.JITSI)) {
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

        Modal.createTrackedDialog('Call already in progress', '', ErrorDialog, {
            title: _t('Call in Progress'),
            description: _t('A call is currently being placed!'),
        });
        return;
    }

    if (currentJitsiWidgets.length > 0) {
        console.warn(
            "Refusing to start conference call widget in " + roomId +
            " a conference call widget is already present",
        );
        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

        Modal.createTrackedDialog('Already have Jitsi Widget', '', ErrorDialog, {
            title: _t('Call in Progress'),
            description: _t('A call is already in progress!'),
        });
        return;
    }

    const confId = `JitsiConference${generateHumanReadableId()}`;
    const jitsiDomain = Jitsi.getInstance().preferredDomain;

    let widgetUrl = WidgetUtils.getLocalJitsiWrapperUrl();

    // TODO: Remove URL hacks when the mobile clients eventually support v2 widgets
    const parsedUrl = new URL(widgetUrl);
    parsedUrl.search = ''; // set to empty string to make the URL class use searchParams instead
    parsedUrl.searchParams.set('confId', confId);
    widgetUrl = parsedUrl.toString();

    const widgetData = {
        conferenceId: confId,
        isAudioOnly: type === 'voice',
        domain: jitsiDomain,
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
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");

            Modal.createTrackedDialog('Call Failed', '', ErrorDialog, {
                title: _t('Permission Required'),
                description: _t("You do not have permission to start a conference call in this room"),
            });
        }
        console.error(e);
    });
}

// FIXME: Nasty way of making sure we only register
// with the dispatcher once
if (!global.mxCallHandler) {
    dis.register(_onAction);
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

const callHandler = {
    getCallForRoom: function(roomId) {
        let call = callHandler.getCall(roomId);
        if (call) return call;

        if (ConferenceHandler) {
            call = ConferenceHandler.getConferenceCallForRoom(roomId);
        }
        if (call) return call;

        return null;
    },

    getCall: function(roomId) {
        return calls[roomId] || null;
    },

    getAnyActiveCall: function() {
        const roomsWithCalls = Object.keys(calls);
        for (let i = 0; i < roomsWithCalls.length; i++) {
            if (calls[roomsWithCalls[i]] &&
                    calls[roomsWithCalls[i]].call_state !== "ended") {
                return calls[roomsWithCalls[i]];
            }
        }
        return null;
    },

    /**
     * The conference handler is a module that deals with implementation-specific
     * multi-party calling implementations. Riot passes in its own which creates
     * a one-to-one call with a freeswitch conference bridge. As of July 2018,
     * the de-facto way of conference calling is a Jitsi widget, so this is
     * deprecated. It reamins here for two reasons:
     *  1. So Riot still supports joining existing freeswitch conference calls
     *     (but doesn't support creating them). After a transition period, we can
     *     remove support for joining them too.
     *  2. To hide the one-to-one rooms that old-style conferencing creates. This
     *     is much harder to remove: probably either we make Riot leave & forget these
     *     rooms after we remove support for joining freeswitch conferences, or we
     *     accept that random rooms with cryptic users will suddently appear for
     *     anyone who's ever used conference calling, or we are stuck with this
     *     code forever.
     *
     * @param {object} confHandler The conference handler object
     */
    setConferenceHandler: function(confHandler) {
        ConferenceHandler = confHandler;
    },

    getConferenceHandler: function() {
        return ConferenceHandler;
    },
};
// Only things in here which actually need to be global are the
// calls list (done separately) and making sure we only register
// with the dispatcher once (which uses this mechanism but checks
// separately). This could be tidied up.
if (global.mxCallHandler === undefined) {
    global.mxCallHandler = callHandler;
}

export default global.mxCallHandler;
