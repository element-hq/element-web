/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { TimelineRenderingType } from "../contexts/RoomContext";
import { Action } from "../dispatcher/actions";
import defaultDispatcher from "../dispatcher/dispatcher";

export const enum Landmark {
    // This is the space/home button in the left panel.
    ACTIVE_SPACE_BUTTON,
    // This is the room filter in the left panel.
    ROOM_SEARCH,
    // This is the currently opened room/first room in the room list in the left panel.
    ROOM_LIST,
    // This is the message composer within the room if available or it is the welcome screen shown when no room is selected
    MESSAGE_COMPOSER_OR_HOME,
}

const ORDERED_LANDMARKS = [
    Landmark.ACTIVE_SPACE_BUTTON,
    Landmark.ROOM_SEARCH,
    Landmark.ROOM_LIST,
    Landmark.MESSAGE_COMPOSER_OR_HOME,
];

/**
 * The landmarks are cycled through in the following order:
 * ACTIVE_SPACE_BUTTON <-> ROOM_SEARCH <-> ROOM_LIST <-> MESSAGE_COMPOSER/HOME <-> ACTIVE_SPACE_BUTTON
 */
export class LandmarkNavigation {
    /**
     * Get the next/previous landmark that must be focused from a given landmark
     * @param currentLandmark The current landmark
     * @param backwards If true, the landmark before currentLandmark in ORDERED_LANDMARKS is returned
     * @returns The next landmark to focus
     */
    private static getLandmark(currentLandmark: Landmark, backwards = false): Landmark {
        const currentIndex = ORDERED_LANDMARKS.findIndex((l) => l === currentLandmark);
        const offset = backwards ? -1 : 1;
        const newLandmark = ORDERED_LANDMARKS.at((currentIndex + offset) % ORDERED_LANDMARKS.length)!;
        return newLandmark;
    }

    /**
     * Focus the next landmark from a given landmark.
     * This method will skip over any missing landmarks.
     * @param currentLandmark The current landmark
     * @param backwards If true, search the next landmark to the left in ORDERED_LANDMARKS
     */
    public static findAndFocusNextLandmark(currentLandmark: Landmark, backwards = false): void {
        let landmark = currentLandmark;
        let element: HTMLElement | null | undefined = null;
        while (element === null) {
            landmark = LandmarkNavigation.getLandmark(landmark, backwards);
            element = landmarkToDomElementMap[landmark]();
        }
        element?.focus({ focusVisible: true });
    }
}

/**
 * The functions return:
 * - The DOM element of the landmark if it exists
 * - undefined if the DOM element exists but focus is given through an action
 * - null if the landmark does not exist
 */
const landmarkToDomElementMap: Record<Landmark, () => HTMLElement | null | undefined> = {
    [Landmark.ACTIVE_SPACE_BUTTON]: () => document.querySelector<HTMLElement>(".mx_SpaceButton_active"),

    [Landmark.ROOM_SEARCH]: () => document.querySelector<HTMLElement>(".mx_RoomSearch"),
    [Landmark.ROOM_LIST]: () =>
        document.querySelector<HTMLElement>(".mx_RoomTile_selected") ||
        document.querySelector<HTMLElement>(".mx_RoomTile"),

    [Landmark.MESSAGE_COMPOSER_OR_HOME]: () => {
        const isComposerOpen = !!document.querySelector(".mx_MessageComposer");
        if (isComposerOpen) {
            const inThread = !!document.activeElement?.closest(".mx_ThreadView");
            defaultDispatcher.dispatch(
                {
                    action: Action.FocusSendMessageComposer,
                    context: inThread ? TimelineRenderingType.Thread : TimelineRenderingType.Room,
                },
                true,
            );
            // Special case where the element does exist but we focus it through an action.
            return undefined;
        } else {
            return document.querySelector<HTMLElement>(".mx_HomePage");
        }
    },
};
