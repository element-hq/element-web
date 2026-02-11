/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { type TagID } from "./models";
import { ListLayout } from "./ListLayout";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";

export default class RoomListLayoutStore extends AsyncStoreWithClient<EmptyObject> {
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
