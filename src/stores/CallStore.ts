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

import { logger } from "matrix-js-sdk/src/logger";
import { GroupCallEventHandlerEvent } from "matrix-js-sdk/src/webrtc/groupCallEventHandler";

import type { GroupCall } from "matrix-js-sdk/src/webrtc/groupCall";
import type { Room } from "matrix-js-sdk/src/models/room";
import defaultDispatcher from "../dispatcher/dispatcher";
import { UPDATE_EVENT } from "./AsyncStore";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import WidgetStore from "./WidgetStore";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import { Call, CallEvent, ConnectionState } from "../models/Call";

export enum CallStoreEvent {
    // Signals a change in the call associated with a given room
    Call = "call",
    // Signals a change in the active calls
    ActiveCalls = "active_calls",
}

export class CallStore extends AsyncStoreWithClient<{}> {
    private static _instance: CallStore;
    public static get instance(): CallStore {
        if (!this._instance) {
            this._instance = new CallStore();
            this._instance.start();
        }
        return this._instance;
    }

    private constructor() {
        super(defaultDispatcher);
    }

    protected async onAction(): Promise<void> {
        // nothing to do
    }

    protected async onReady(): Promise<any> {
        if (!this.matrixClient) return;
        // We assume that the calls present in a room are a function of room
        // widgets and group calls, so we initialize the room map here and then
        // update it whenever those change
        for (const room of this.matrixClient.getRooms()) {
            this.updateRoom(room);
        }
        this.matrixClient.on(GroupCallEventHandlerEvent.Incoming, this.onGroupCall);
        this.matrixClient.on(GroupCallEventHandlerEvent.Outgoing, this.onGroupCall);
        WidgetStore.instance.on(UPDATE_EVENT, this.onWidgets);

        // If the room ID of a previously connected call is still in settings at
        // this time, that's a sign that we failed to disconnect from it
        // properly, and need to clean up after ourselves
        const uncleanlyDisconnectedRoomIds = SettingsStore.getValue<string[]>("activeCallRoomIds");
        if (uncleanlyDisconnectedRoomIds.length) {
            await Promise.all([
                ...uncleanlyDisconnectedRoomIds.map(async (uncleanlyDisconnectedRoomId): Promise<void> => {
                    logger.log(`Cleaning up call state for room ${uncleanlyDisconnectedRoomId}`);
                    await this.getCall(uncleanlyDisconnectedRoomId)?.clean();
                }),
                SettingsStore.setValue("activeCallRoomIds", null, SettingLevel.DEVICE, []),
            ]);
        }
    }

    protected async onNotReady(): Promise<any> {
        for (const [call, listenerMap] of this.callListeners) {
            // It's important that we remove the listeners before destroying the
            // call, because otherwise the call's onDestroy callback would fire
            // and immediately repopulate the map
            for (const [event, listener] of listenerMap) call.off(event, listener);
            call.destroy();
        }
        this.callListeners.clear();
        this.calls.clear();
        this._activeCalls.clear();

        if (this.matrixClient) {
            this.matrixClient.off(GroupCallEventHandlerEvent.Incoming, this.onGroupCall);
            this.matrixClient.off(GroupCallEventHandlerEvent.Outgoing, this.onGroupCall);
            this.matrixClient.off(GroupCallEventHandlerEvent.Ended, this.onGroupCall);
        }
        WidgetStore.instance.off(UPDATE_EVENT, this.onWidgets);
    }

    private _activeCalls: Set<Call> = new Set();
    /**
     * The calls to which the user is currently connected.
     */
    public get activeCalls(): Set<Call> {
        return this._activeCalls;
    }
    private set activeCalls(value: Set<Call>) {
        this._activeCalls = value;
        this.emit(CallStoreEvent.ActiveCalls, value);

        // The room IDs are persisted to settings so we can detect unclean disconnects
        SettingsStore.setValue(
            "activeCallRoomIds",
            null,
            SettingLevel.DEVICE,
            [...value].map((call) => call.roomId),
        );
    }

    private calls = new Map<string, Call>(); // Key is room ID
    private callListeners = new Map<Call, Map<CallEvent, (...args: unknown[]) => unknown>>();

    private updateRoom(room: Room): void {
        if (!this.calls.has(room.roomId)) {
            const call = Call.get(room);

            if (call) {
                const onConnectionState = (state: ConnectionState): void => {
                    if (state === ConnectionState.Connected) {
                        this.activeCalls = new Set([...this.activeCalls, call]);
                    } else if (state === ConnectionState.Disconnected) {
                        this.activeCalls = new Set([...this.activeCalls].filter((c) => c !== call));
                    }
                };
                const onDestroy = (): void => {
                    this.calls.delete(room.roomId);
                    for (const [event, listener] of this.callListeners.get(call)!) call.off(event, listener);
                    this.updateRoom(room);
                };

                call.on(CallEvent.ConnectionState, onConnectionState);
                call.on(CallEvent.Destroy, onDestroy);

                this.calls.set(room.roomId, call);
                this.callListeners.set(
                    call,
                    new Map<CallEvent, (...args: any[]) => unknown>([
                        [CallEvent.ConnectionState, onConnectionState],
                        [CallEvent.Destroy, onDestroy],
                    ]),
                );
            }

            this.emit(CallStoreEvent.Call, call, room.roomId);
        }
    }

    /**
     * Gets the call associated with the given room, if any.
     * @param {string} roomId The room's ID.
     * @returns {Call | null} The call.
     */
    public getCall(roomId: string): Call | null {
        return this.calls.get(roomId) ?? null;
    }

    /**
     * Gets the active call associated with the given room, if any.
     * @param roomId The room's ID.
     * @returns The active call.
     */
    public getActiveCall(roomId: string): Call | null {
        const call = this.getCall(roomId);
        return call !== null && this.activeCalls.has(call) ? call : null;
    }

    private onWidgets = (roomId: string | null): void => {
        if (!this.matrixClient) return;
        if (roomId === null) {
            // This store happened to start before the widget store was done
            // loading all rooms, so we need to initialize each room again
            for (const room of this.matrixClient.getRooms()) {
                this.updateRoom(room);
            }
        } else {
            const room = this.matrixClient.getRoom(roomId);
            // Widget updates can arrive before the room does, empirically
            if (room !== null) this.updateRoom(room);
        }
    };

    private onGroupCall = (groupCall: GroupCall): void => this.updateRoom(groupCall.room);
}
