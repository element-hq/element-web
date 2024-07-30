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

import type { Room } from "matrix-js-sdk/src/matrix";
import SettingsStore from "../settings/SettingsStore";
import { useFeatureEnabled } from "../hooks/useSettings";

function checkIsVideoRoom(room: Room, elementCallVideoRoomsEnabled: boolean): boolean {
    return room.isElementVideoRoom() || (elementCallVideoRoomsEnabled && room.isCallRoom());
}

export const isVideoRoom = (room: Room): boolean =>
    checkIsVideoRoom(room, SettingsStore.getValue("feature_element_call_video_rooms"));

/**
 * Returns whether the given room is a video room based on the current feature flags.
 * @param room The room to check.
 * @param skipVideoRoomsEnabledCheck If true, the check for the video rooms feature flag is skipped,
 * useful for suggesting to the user to enable the labs flag.
 */
export const useIsVideoRoom = (room?: Room, skipVideoRoomsEnabledCheck = false): boolean => {
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms"); // react to updates as isVideoRoom reads the value itself

    if (!room) return false;
    if (!videoRoomsEnabled && !skipVideoRoomsEnabledCheck) return false;
    return checkIsVideoRoom(room, elementCallVideoRoomsEnabled);
};
