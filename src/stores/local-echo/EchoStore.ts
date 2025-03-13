/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type GenericEchoChamber } from "./GenericEchoChamber";
import { RoomEchoChamber } from "./RoomEchoChamber";
import { RoomEchoContext } from "./RoomEchoContext";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";
import { ContextTransactionState, type EchoContext } from "./EchoContext";
import NonUrgentToastStore, { type ToastReference } from "../NonUrgentToastStore";
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
