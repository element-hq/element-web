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

import VideoChannelStore, { VideoChannelEvent } from "../../src/stores/VideoChannelStore";

class StubVideoChannelStore extends EventEmitter {
    private _roomId: string;
    public get roomId(): string { return this._roomId; }

    public connect = (roomId: string) => {
        this._roomId = roomId;
        this.emit(VideoChannelEvent.Connect);
    };
    public disconnect = () => {
        this._roomId = null;
        this.emit(VideoChannelEvent.Disconnect);
    };
}

export const stubVideoChannelStore = (): StubVideoChannelStore => {
    const store = new StubVideoChannelStore();
    jest.spyOn(VideoChannelStore, "instance", "get").mockReturnValue(store as unknown as VideoChannelStore);
    return store;
};
