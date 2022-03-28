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

import { EventEmitter } from "events";

import VoiceChannelStore, { VoiceChannelEvent } from "../../src/stores/VoiceChannelStore";

class StubVoiceChannelStore extends EventEmitter {
    private _roomId: string;
    public get roomId(): string { return this._roomId; }
    private _audioMuted: boolean;
    public get audioMuted(): boolean { return this._audioMuted; }
    private _videoMuted: boolean;
    public get videoMuted(): boolean { return this._videoMuted; }

    public connect = jest.fn().mockImplementation(async (roomId: string) => {
        this._roomId = roomId;
        this._audioMuted = true;
        this._videoMuted = true;
        this.emit(VoiceChannelEvent.Connect);
    });
    public disconnect = jest.fn().mockImplementation(async () => {
        this._roomId = null;
        this.emit(VoiceChannelEvent.Disconnect);
    });
    public muteAudio = jest.fn().mockImplementation(async () => {
        this._audioMuted = true;
        this.emit(VoiceChannelEvent.MuteAudio);
    });
    public unmuteAudio = jest.fn().mockImplementation(async () => {
        this._audioMuted = false;
        this.emit(VoiceChannelEvent.UnmuteAudio);
    });
    public muteVideo = jest.fn().mockImplementation(async () => {
        this._videoMuted = true;
        this.emit(VoiceChannelEvent.MuteVideo);
    });
    public unmuteVideo = jest.fn().mockImplementation(async () => {
        this._videoMuted = false;
        this.emit(VoiceChannelEvent.UnmuteVideo);
    });
}

export const stubVoiceChannelStore = () => {
    jest.spyOn(VoiceChannelStore, "instance", "get")
        .mockReturnValue(new StubVoiceChannelStore() as unknown as VoiceChannelStore);
};
