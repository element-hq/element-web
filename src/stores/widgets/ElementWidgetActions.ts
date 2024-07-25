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
    StartLiveStream = "im.vector.start_live_stream",

    // Actions for switching layouts
    TileLayout = "io.element.tile_layout",
    SpotlightLayout = "io.element.spotlight_layout",

    OpenIntegrationManager = "integration_manager_open",
    /**
     * @deprecated Use MSC2931 instead
     */
    ViewRoom = "io.element.view_room",

    // This action type is used as a `fromWidget` and a `toWidget` action.
    // fromWidget: updates the client about the current device mute state
    // toWidget: the client requests a specific device mute configuration
    //   The reply will always be the resulting configuration
    //   It is possible to sent an empty configuration to retrieve the current values or
    //   just one of the fields to update that particular value
    //   An undefined field means that EC will keep the mute state as is.
    //   -> this will allow the client to only get the current state
    //
    // The data of the widget action request and the response are:
    // {
    //   audio_enabled?: boolean,
    //   video_enabled?: boolean
    // }
    // NOTE: this is currently unused. Its only here to make EW aware
    // of this action so it does not throw errors.
    DeviceMute = "io.element.device_mute",
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
