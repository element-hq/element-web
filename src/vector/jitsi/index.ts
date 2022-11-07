/*
Copyright 2020-2022 New Vector Ltd.

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

import { KJUR } from 'jsrsasign';
import {
    IOpenIDCredentials,
    IWidgetApiRequest,
    IWidgetApiRequestData,
    IWidgetApiResponseData,
    VideoConferenceCapabilities,
    WidgetApi,
    WidgetApiAction,
} from "matrix-widget-api";
import { ElementWidgetActions } from "matrix-react-sdk/src/stores/widgets/ElementWidgetActions";
import { logger } from "matrix-js-sdk/src/logger";
import { IConfigOptions } from "matrix-react-sdk/src/IConfigOptions";
import { SnakedObject } from "matrix-react-sdk/src/utils/SnakedObject";

import { getVectorConfig } from "../getconfig";

// We have to trick webpack into loading our CSS for us.
require("./index.pcss");

const JITSI_OPENIDTOKEN_JWT_AUTH = 'openidtoken-jwt';

// Dev note: we use raw JS without many dependencies to reduce bundle size.
// We do not need all of React to render a Jitsi conference.

declare let JitsiMeetExternalAPI: any;

let inConference = false;

// Jitsi params
let jitsiDomain: string;
let conferenceId: string;
let displayName: string;
let avatarUrl: string;
let userId: string;
let jitsiAuth: string;
let roomId: string;
let openIdToken: IOpenIDCredentials;
let roomName: string;
let startAudioOnly: boolean;
let isVideoChannel: boolean;
let supportsScreensharing: boolean;

let widgetApi: WidgetApi;
let meetApi: any; // JitsiMeetExternalAPI
let skipOurWelcomeScreen = false;

const setupCompleted = (async () => {
    try {
        // Queue a config.json lookup asap, so we can use it later on. We want this to be concurrent with
        // other setup work and therefore do not block.
        const configPromise = getVectorConfig();

        // The widget's options are encoded into the fragment to avoid leaking info to the server.
        const widgetQuery = new URLSearchParams(window.location.hash.substring(1));
        // The widget spec on the other hand requires the widgetId and parentUrl to show up in the regular query string.
        const realQuery = new URLSearchParams(window.location.search.substring(1));
        const qsParam = (name: string, optional = false): string => {
            const vals = widgetQuery.has(name) ? widgetQuery.getAll(name) : realQuery.getAll(name);
            if (!optional && vals.length !== 1) {
                throw new Error(`Expected singular ${name} in query string`);
            }
            return vals[0];
        };

        // If we have these params, expect a widget API to be available (ie. to be in an iframe
        // inside a matrix client). Otherwise, assume we're on our own, eg. have been popped
        // out into a browser.
        const parentUrl = qsParam('parentUrl', true);
        const widgetId = qsParam('widgetId', true);
        const theme = qsParam('theme', true);

        if (theme) {
            document.body.classList.add(`theme-${theme.replace(" ", "_")}`);
        }

        // Set this up as early as possible because Element will be hitting it almost immediately.
        let widgetApiReady: Promise<void>;
        if (parentUrl && widgetId) {
            const parentOrigin = new URL(qsParam('parentUrl')).origin;
            widgetApi = new WidgetApi(qsParam("widgetId"), parentOrigin);

            widgetApiReady = new Promise<void>(resolve => widgetApi.once("ready", resolve));
            widgetApi.requestCapabilities(VideoConferenceCapabilities);
            widgetApi.start();

            const handleAction = (
                action: WidgetApiAction,
                handler: (request: IWidgetApiRequestData) => Promise<void>,
            ): void => {
                widgetApi.on(`action:${action}`, async (ev: CustomEvent<IWidgetApiRequest>) => {
                    ev.preventDefault();
                    await setupCompleted;

                    let response: IWidgetApiResponseData;
                    try {
                        await handler(ev.detail.data);
                        response = {};
                    } catch (e) {
                        if (e instanceof Error) {
                            response = { error: { message: e.message } };
                        } else {
                            throw e;
                        }
                    }

                    await widgetApi.transport.reply(ev.detail, response);
                });
            };

            handleAction(ElementWidgetActions.JoinCall, async ({ audioInput, videoInput }) => {
                joinConference(audioInput as string | null, videoInput as string | null);
            });
            handleAction(ElementWidgetActions.HangupCall, async ({ force }) => {
                if (force === true) {
                    meetApi?.dispose();
                    notifyHangup();
                    meetApi = null;
                    closeConference();
                } else {
                    meetApi?.executeCommand('hangup');
                }
            });
            handleAction(ElementWidgetActions.MuteAudio, async () => {
                if (meetApi && !await meetApi.isAudioMuted()) {
                    meetApi.executeCommand('toggleAudio');
                }
            });
            handleAction(ElementWidgetActions.UnmuteAudio, async () => {
                if (meetApi && await meetApi.isAudioMuted()) {
                    meetApi.executeCommand('toggleAudio');
                }
            });
            handleAction(ElementWidgetActions.MuteVideo, async () => {
                if (meetApi && !await meetApi.isVideoMuted()) {
                    meetApi.executeCommand('toggleVideo');
                }
            });
            handleAction(ElementWidgetActions.UnmuteVideo, async () => {
                if (meetApi && await meetApi.isVideoMuted()) {
                    meetApi.executeCommand('toggleVideo');
                }
            });
            handleAction(ElementWidgetActions.TileLayout, async () => {
                meetApi?.executeCommand('setTileView', true);
            });
            handleAction(ElementWidgetActions.SpotlightLayout, async () => {
                meetApi?.executeCommand('setTileView', false);
            });
            handleAction(ElementWidgetActions.StartLiveStream, async ({ rtmpStreamKey }) => {
                if (!meetApi) throw new Error("Conference not joined");
                meetApi.executeCommand('startRecording', {
                    mode: 'stream',
                    // this looks like it should be rtmpStreamKey but we may be on too old
                    // a version of jitsi meet
                    //rtmpStreamKey,
                    youtubeStreamKey: rtmpStreamKey,
                });
            });
        } else {
            logger.warn("No parent URL or no widget ID - assuming no widget API is available");
        }

        // Populate the Jitsi params now
        jitsiDomain = qsParam('conferenceDomain');
        conferenceId = qsParam('conferenceId');
        displayName = qsParam('displayName', true);
        avatarUrl = qsParam('avatarUrl', true); // http not mxc
        userId = qsParam('userId');
        jitsiAuth = qsParam('auth', true);
        roomId = qsParam('roomId', true);
        roomName = qsParam('roomName', true);
        startAudioOnly = qsParam('isAudioOnly', true) === "true";
        isVideoChannel = qsParam('isVideoChannel', true) === "true";
        supportsScreensharing = qsParam('supportsScreensharing', true) === "true";

        // We've reached the point where we have to wait for the config, so do that then parse it.
        const instanceConfig = new SnakedObject<IConfigOptions>((await configPromise) ?? <IConfigOptions>{});
        const jitsiConfig = instanceConfig.get("jitsi_widget") ?? {};
        skipOurWelcomeScreen = (new SnakedObject<IConfigOptions["jitsi_widget"]>(jitsiConfig))
            .get("skip_built_in_welcome_screen") ?? false;

        // Either reveal the prejoin screen, or skip straight to Jitsi depending on the config.
        // We don't set up the call yet though as this might lead to failure without the widget API.
        toggleConferenceVisibility(skipOurWelcomeScreen);

        if (widgetApi) {
            await widgetApiReady;

            // See https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
            if (jitsiAuth === JITSI_OPENIDTOKEN_JWT_AUTH) {
                // Request credentials, give callback to continue when received
                openIdToken = await widgetApi.requestOpenIDConnectToken();
                logger.log("Got OpenID Connect token");
            }
        }

        // Now that everything should be set up, skip to the Jitsi splash screen if needed
        if (skipOurWelcomeScreen) {
            skipToJitsiSplashScreen();
        }

        enableJoinButton(); // always enable the button
    } catch (e) {
        logger.error("Error setting up Jitsi widget", e);
        document.getElementById("widgetActionContainer").innerText = "Failed to load Jitsi widget";
    }
})();

function enableJoinButton() {
    document.getElementById("joinButton").onclick = () => joinConference();
}

function switchVisibleContainers() {
    inConference = !inConference;

    // Our welcome screen is managed by other code, so just don't switch to it ever
    // if we're not supposed to.
    if (!skipOurWelcomeScreen) {
        toggleConferenceVisibility(inConference);
    }
}

function toggleConferenceVisibility(inConference: boolean) {
    document.getElementById("jitsiContainer").style.visibility = inConference ? 'unset' : 'hidden';
    // Video rooms have a separate UI for joining, so they should never show our join button
    document.getElementById("joinButtonContainer").style.visibility =
        (inConference || isVideoChannel) ? 'hidden' : 'unset';
}

function skipToJitsiSplashScreen() {
    // really just a function alias for self-documenting code
    joinConference();
}

/**
 * Create a JWT token fot jitsi openidtoken-jwt auth
 *
 * See https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
 */
function createJWTToken() {
    // Header
    const header = { alg: 'HS256', typ: 'JWT' };
    // Payload
    const payload = {
        // As per Jitsi token auth, `iss` needs to be set to something agreed between
        // JWT generating side and Prosody config. Since we have no configuration for
        // the widgets, we can't set one anywhere. Using the Jitsi domain here probably makes sense.
        iss: jitsiDomain,
        sub: jitsiDomain,
        aud: `https://${jitsiDomain}`,
        room: "*",
        context: {
            matrix: {
                token: openIdToken.access_token,
                room_id: roomId,
                server_name: openIdToken.matrix_server_name,
            },
            user: {
                avatar: avatarUrl,
                name: displayName,
            },
        },
    };
    // Sign JWT
    // The secret string here is irrelevant, we're only using the JWT
    // to transport data to Prosody in the Jitsi stack.
    return KJUR.jws.JWS.sign(
        'HS256',
        JSON.stringify(header),
        JSON.stringify(payload),
        'notused',
    );
}

async function notifyHangup(errorMessage?: string) {
    if (widgetApi) {
        // We send the hangup event before setAlwaysOnScreen, because the latter
        // can cause the receiving side to instantly stop listening.
        try {
            await widgetApi.transport.send(ElementWidgetActions.HangupCall, { errorMessage });
        } finally {
            await widgetApi.setAlwaysOnScreen(false);
        }
    }
}

function closeConference() {
    switchVisibleContainers();
    document.getElementById("jitsiContainer").innerHTML = "";

    if (skipOurWelcomeScreen) {
        skipToJitsiSplashScreen();
    }
}

// event handler bound in HTML
// An audio input of undefined instructs Jitsi to start unmuted with whatever
// audio input it can find, while an input of null instructs it to start muted,
// and a non-nullish input specifies the label of a specific device to use.
// Same for video inputs.
function joinConference(audioInput?: string | null, videoInput?: string | null) {
    let jwt;
    if (jitsiAuth === JITSI_OPENIDTOKEN_JWT_AUTH) {
        if (!openIdToken?.access_token) { // eslint-disable-line camelcase
            // We've failing to get a token, don't try to init conference
            logger.warn('Expected to have an OpenID credential, cannot initialize widget.');
            document.getElementById("widgetActionContainer").innerText = "Failed to load Jitsi widget";
            return;
        }
        jwt = createJWTToken();
    }

    switchVisibleContainers();

    logger.warn(
        "[Jitsi Widget] The next few errors about failing to parse URL parameters are fine if " +
        "they mention 'external_api' or 'jitsi' in the stack. They're just Jitsi Meet trying to parse " +
        "our fragment values and not recognizing the options.",
    );

    const options = {
        width: "100%",
        height: "100%",
        parentNode: document.querySelector("#jitsiContainer"),
        roomName: conferenceId,
        devices: {
            audioInput,
            videoInput,
        },
        userInfo: {
            displayName,
            email: userId,
        },
        interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            MAIN_TOOLBAR_BUTTONS: [],
            VIDEO_LAYOUT_FIT: "height",
        },
        configOverwrite: {
            subject: roomName,
            startAudioOnly,
            startWithAudioMuted: audioInput === null,
            startWithVideoMuted: videoInput === null,
            // Request some log levels for inclusion in rageshakes
            // Ideally we would capture all possible log levels, but this can
            // cause Jitsi Meet to try to post various circular data structures
            // back over the iframe API, and therefore end up crashing
            // https://github.com/jitsi/jitsi-meet/issues/11585
            apiLogLevels: ["warn", "error"],
        } as any,
        jwt: jwt,
    };

    // Video channel widgets need some more tailored config options
    if (isVideoChannel) {
        // Ensure that we skip Jitsi Meet's native prejoin screen, for
        // deployments that have it enabled
        options.configOverwrite.prejoinConfig = { enabled: false };
        // Use a simplified set of toolbar buttons
        options.configOverwrite.toolbarButtons = ["microphone", "camera", "tileview", "hangup"];
        // Note: We can hide the screenshare button in video rooms but not in
        // normal conference calls, since in video rooms we control exactly what
        // set of controls appear, but in normal calls we need to leave that up
        // to the deployment's configuration.
        // https://github.com/vector-im/element-web/issues/4880#issuecomment-940002464
        if (supportsScreensharing) options.configOverwrite.toolbarButtons.splice(2, 0, "desktop");
        // Hide all top bar elements
        options.configOverwrite.conferenceInfo = { autoHide: [] };
        // Remove the ability to hide your own tile, since we're hiding the
        // settings button which would be the only way to get it back
        options.configOverwrite.disableSelfViewSettings = true;
    }

    meetApi = new JitsiMeetExternalAPI(jitsiDomain, options);

    // fires once when user joins the conference
    // (regardless of video on or off)
    meetApi.on("videoConferenceJoined", onVideoConferenceJoined);
    meetApi.on("videoConferenceLeft", onVideoConferenceLeft);
    meetApi.on("readyToClose", closeConference);
    meetApi.on("errorOccurred", onErrorOccurred);
    meetApi.on("audioMuteStatusChanged", onAudioMuteStatusChanged);
    meetApi.on("videoMuteStatusChanged", onVideoMuteStatusChanged);

    ["videoConferenceJoined", "participantJoined", "participantLeft"].forEach(event => {
        meetApi.on(event, updateParticipants);
    });

    // Patch logs into rageshakes
    meetApi.on("log", onLog);
}

const onVideoConferenceJoined = () => {
    // Although we set our displayName with the userInfo option above, that
    // option has a bug where it causes the name to be the HTML encoding of
    // what was actually intended. So, we use the displayName command to at
    // least ensure that the name is correct after entering the meeting.
    // https://github.com/jitsi/jitsi-meet/issues/11664
    // We can't just use these commands immediately after creating the
    // iframe, because there's *another* bug where they can crash Jitsi by
    // racing with its startup process.
    if (displayName) meetApi.executeCommand("displayName", displayName);
    // This doesn't have a userInfo equivalent, so has to be set via commands
    if (avatarUrl) meetApi.executeCommand("avatarUrl", avatarUrl);

    if (widgetApi) {
        // ignored promise because we don't care if it works
        // noinspection JSIgnoredPromiseFromCall
        widgetApi.setAlwaysOnScreen(true);
        widgetApi.transport.send(ElementWidgetActions.JoinCall, {});
    }

    // Video rooms should start in tile mode
    if (isVideoChannel) meetApi.executeCommand("setTileView", true);
};

const onVideoConferenceLeft = () => {
    notifyHangup();
    meetApi = null;
};

const onErrorOccurred = ({ error }) => {
    if (error.isFatal) {
        // We got disconnected. Since Jitsi Meet might send us back to the
        // prejoin screen, we're forced to act as if we hung up entirely.
        notifyHangup(error.message);
        meetApi = null;
        closeConference();
    }
};

const onAudioMuteStatusChanged = ({ muted }) => {
    const action = muted ? ElementWidgetActions.MuteAudio : ElementWidgetActions.UnmuteAudio;
    widgetApi?.transport.send(action, {});
};

const onVideoMuteStatusChanged = ({ muted }) => {
    if (muted) {
        // Jitsi Meet always sends a "video muted" event directly before
        // hanging up, which we need to ignore by padding the timeout here,
        // otherwise the React SDK will mistakenly think the user turned off
        // their video by hand
        setTimeout(() => {
            if (meetApi) widgetApi?.transport.send(ElementWidgetActions.MuteVideo, {});
        }, 200);
    } else {
        widgetApi?.transport.send(ElementWidgetActions.UnmuteVideo, {});
    }
};

const updateParticipants = () => {
    widgetApi?.transport.send(ElementWidgetActions.CallParticipants, {
        participants: meetApi.getParticipantsInfo(),
    });
};

const onLog = ({ logLevel, args }) =>
    (parent as unknown as typeof global).mx_rage_logger?.log(logLevel, ...args);
