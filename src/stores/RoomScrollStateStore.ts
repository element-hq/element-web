/*
Copyright 2017-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface ScrollState {
    focussedEvent?: string;
    pixelOffset?: number;
}

/**
 * Stores where the user has scrolled to in each room
 */
export class RoomScrollStateStore {
    // A map from room id to scroll state.
    //
    // If there is no special scroll state (ie, we are following the live
    // timeline), the scroll state is null. Otherwise, it is an object with
    // the following properties:
    //
    //    focussedEvent: the ID of the 'focussed' event. Typically this is
    //        the last event fully visible in the viewport, though if we
    //        have done an explicit scroll to an explicit event, it will be
    //        that event.
    //
    //    pixelOffset: the number of pixels the window is scrolled down
    //        from the focussedEvent.
    private scrollStateMap = new Map<string, ScrollState>();

    public getScrollState(roomId: string): ScrollState | undefined {
        return this.scrollStateMap.get(roomId);
    }

    public setScrollState(roomId: string, scrollState: ScrollState | null): void {
        if (scrollState === null) {
            this.scrollStateMap.delete(roomId);
        } else {
            this.scrollStateMap.set(roomId, scrollState);
        }
    }
}

if (window.mxRoomScrollStateStore === undefined) {
    window.mxRoomScrollStateStore = new RoomScrollStateStore();
}
export default window.mxRoomScrollStateStore!;
