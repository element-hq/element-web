/*
 * Copyright 2020-2022 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { IWidgetApiRequest } from "matrix-widget-api";

export enum ElementWidgetActions {
    // All of these actions are currently specific to Jitsi and Element Call
    JoinCall = "io.element.join",
    HangupCall = "im.vector.hangup",
    CallParticipants = "io.element.participants",
    MuteAudio = "io.element.mute_audio",
    UnmuteAudio = "io.element.unmute_audio",
    MuteVideo = "io.element.mute_video",
    UnmuteVideo = "io.element.unmute_video",
    StartLiveStream = "im.vector.start_live_stream",

    // Element Call -> host requesting to start a screenshare
    // (ie. expects a ScreenshareStart once the user has picked a source)
    // replies with { pending } where pending is true if the host has asked
    // the user to choose a window and false if not (ie. if the host isn't
    // running within Electron)
    ScreenshareRequest = "io.element.screenshare_request",
    // host -> Element Call telling EC to start screen sharing with
    // the given source
    ScreenshareStart = "io.element.screenshare_start",
    // host -> Element Call telling EC to stop screen sharing, or that
    // the user cancelled when selecting a source after a ScreenshareRequest
    ScreenshareStop = "io.element.screenshare_stop",

    // Actions for switching layouts
    TileLayout = "io.element.tile_layout",
    SpotlightLayout = "io.element.spotlight_layout",

    OpenIntegrationManager = "integration_manager_open",

    /**
     * @deprecated Use MSC2931 instead
     */
    ViewRoom = "io.element.view_room",
}

export interface IHangupCallApiRequest extends IWidgetApiRequest {
    data: {
        errorMessage?: string;
    };
}

/**
 * @deprecated Use MSC2931 instead
 */
export interface IViewRoomApiRequest extends IWidgetApiRequest {
    data: {
        room_id: string; // eslint-disable-line camelcase
    };
}
