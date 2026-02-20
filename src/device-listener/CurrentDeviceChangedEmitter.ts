/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import { type DeviceState } from ".";

/**
 * The events emitted when the {@link DeviceState} of the current device
 * changes.
 */
export const enum CurrentDeviceEvents {
    DeviceStateChanged = "device_state",
}

/**
 * You must provide one of these if you listen to {@link CurrentDeviceEvents}
 * emitted by {@link DeviceListenerCurrentDevice}. It specifies how to handle
 * each type of event.
 */
type EventHandlerMap = {
    [CurrentDeviceEvents.DeviceStateChanged]: (state: DeviceState) => void;
};

/**
 * Emits events when the current device changes state.
 */
export class CurrentDeviceChangedEmitter extends TypedEventEmitter<CurrentDeviceEvents, EventHandlerMap> {
    public onStateChanged(newState: DeviceState): void {
        this.emit(CurrentDeviceEvents.DeviceStateChanged, newState);
    }
}
