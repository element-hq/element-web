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

import { Room } from "matrix-js-sdk/src/models/room";

import { GenericEchoChamber } from "./GenericEchoChamber";
import { RoomEchoChamber } from "./RoomEchoChamber";
import { RoomEchoContext } from "./RoomEchoContext";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { ContextTransactionState, EchoContext } from "./EchoContext";
import NonUrgentToastStore, { ToastReference } from "../NonUrgentToastStore";
import NonUrgentEchoFailureToast from "../../components/views/toasts/NonUrgentEchoFailureToast";

interface IState {
    toastRef: ToastReference;
}

type ContextKey = string;

const roomContextKey = (room: Room): ContextKey => `room-${room.roomId}`;

export class EchoStore extends AsyncStoreWithClient<IState> {
    private static _instance: EchoStore;

    private caches = new Map<ContextKey, GenericEchoChamber<any, any, any>>();

    public constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): EchoStore {
        if (!this._instance) {
            this._instance = new EchoStore();
            this._instance.start();
        }
        return this._instance;
    }

    public get contexts(): EchoContext[] {
        return Array.from(this.caches.values()).map((e) => e.context);
    }

    public getOrCreateChamberForRoom(room: Room): RoomEchoChamber {
        if (this.caches.has(roomContextKey(room))) {
            return this.caches.get(roomContextKey(room)) as RoomEchoChamber;
        }

        const context = new RoomEchoContext(room);
        context.whenAnything(() => this.checkContexts());

        const echo = new RoomEchoChamber(context);
        echo.setClient(this.matrixClient);
        this.caches.set(roomContextKey(room), echo);

        return echo;
    }

    private async checkContexts(): Promise<void> {
        let hasOrHadError = false;
        for (const echo of this.caches.values()) {
            hasOrHadError = echo.context.state === ContextTransactionState.PendingErrors;
            if (hasOrHadError) break;
        }

        if (hasOrHadError && !this.state.toastRef) {
            const ref = NonUrgentToastStore.instance.addToast(NonUrgentEchoFailureToast);
            await this.updateState({ toastRef: ref });
        } else if (!hasOrHadError && this.state.toastRef) {
            NonUrgentToastStore.instance.removeToast(this.state.toastRef);
            await this.updateState({ toastRef: null });
        }
    }

    protected async onReady(): Promise<any> {
        if (!this.caches) return; // can only happen during initialization
        for (const echo of this.caches.values()) {
            echo.setClient(this.matrixClient);
        }
    }

    protected async onNotReady(): Promise<any> {
        for (const echo of this.caches.values()) {
            echo.setClient(null);
        }
    }

    protected async onAction(payload: ActionPayload): Promise<void> {}
}
