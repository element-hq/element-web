/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { CallType } from "matrix-js-sdk/src/webrtc/call";

import WidgetStore, { IApp } from "../stores/WidgetStore";
import { WidgetType } from "../widgets/WidgetType";
import WidgetUtils from "./WidgetUtils";

export const VOICE_CHANNEL_ID = "io.element.voice";

export const getVoiceChannel = (roomId: string): IApp => {
    const apps = WidgetStore.instance.getApps(roomId);
    return apps.find(app => WidgetType.JITSI.matches(app.type) && app.id === VOICE_CHANNEL_ID);
};

export const addVoiceChannel = async (roomId: string, roomName: string) => {
    await WidgetUtils.addJitsiWidget(roomId, CallType.Voice, "Voice channel", VOICE_CHANNEL_ID, roomName);
};
