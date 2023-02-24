/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";

import { TagID } from "./models";
import { ListLayout } from "./ListLayout";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";

interface IState {}

export default class RoomListLayoutStore extends AsyncStoreWithClient<IState> {
    private static internalInstance: RoomListLayoutStore;

    private readonly layoutMap = new Map<TagID, ListLayout>();

    public constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): RoomListLayoutStore {
        if (!this.internalInstance) {
            this.internalInstance = new RoomListLayoutStore();
            this.internalInstance.start();
        }
        return RoomListLayoutStore.internalInstance;
    }

    public ensureLayoutExists(tagId: TagID): void {
        if (!this.layoutMap.has(tagId)) {
            this.layoutMap.set(tagId, new ListLayout(tagId));
        }
    }

    public getLayoutFor(tagId: TagID): ListLayout {
        if (!this.layoutMap.has(tagId)) {
            this.layoutMap.set(tagId, new ListLayout(tagId));
        }
        return this.layoutMap.get(tagId)!;
    }

    // Note: this primarily exists for debugging, and isn't really intended to be used by anything.
    public async resetLayouts(): Promise<void> {
        logger.warn("Resetting layouts for room list");
        for (const layout of this.layoutMap.values()) {
            layout.reset();
        }
    }

    protected async onNotReady(): Promise<any> {
        // On logout, clear the map.
        this.layoutMap.clear();
    }

    // We don't need this function, but our contract says we do
    protected async onAction(payload: ActionPayload): Promise<void> {}
}

window.mxRoomListLayoutStore = RoomListLayoutStore.instance;
