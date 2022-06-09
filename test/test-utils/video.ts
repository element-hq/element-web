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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { mkEvent } from "./test-utils";
import { VIDEO_CHANNEL_MEMBER, STUCK_DEVICE_TIMEOUT_MS } from "../../src/utils/VideoChannelUtils";
import VideoChannelStore, { VideoChannelEvent, IJitsiParticipant } from "../../src/stores/VideoChannelStore";

export class StubVideoChannelStore extends EventEmitter {
    private _roomId: string | null;
    public get roomId(): string | null { return this._roomId; }
    public set roomId(value: string | null) { this._roomId = value; }
    private _connected: boolean;
    public get connected(): boolean { return this._connected; }
    public get participants(): IJitsiParticipant[] { return []; }

    public startConnect = (roomId: string) => {
        this.roomId = roomId;
        this.emit(VideoChannelEvent.StartConnect, roomId);
    };
    public connect = jest.fn((roomId: string) => {
        this.roomId = roomId;
        this._connected = true;
        this.emit(VideoChannelEvent.Connect, roomId);
    });
    public disconnect = jest.fn(() => {
        const roomId = this._roomId;
        this.roomId = null;
        this._connected = false;
        this.emit(VideoChannelEvent.Disconnect, roomId);
    });
}

export const stubVideoChannelStore = (): StubVideoChannelStore => {
    const store = new StubVideoChannelStore();
    jest.spyOn(VideoChannelStore, "instance", "get").mockReturnValue(store as unknown as VideoChannelStore);
    return store;
};

export const mkVideoChannelMember = (userId: string, devices: string[], expiresAt?: number): MatrixEvent => mkEvent({
    event: true,
    type: VIDEO_CHANNEL_MEMBER,
    room: "!1:example.org",
    user: userId,
    skey: userId,
    content: {
        devices,
        expires_ts: expiresAt == null ? Date.now() + STUCK_DEVICE_TIMEOUT_MS : expiresAt,
    },
});
