/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import { useState } from "react";

import { useTypedEventEmitter, useTypedEventEmitterState } from "./useEventEmitter";
import { Feature, ReleaseAnnouncementStore } from "../stores/ReleaseAnnouncementStore";
import Modal, { ModalManagerEvent } from "../Modal";

/**
 * Hook to return true if a modal is opened
 */
function useModalOpened(): boolean {
    const [opened, setOpened] = useState(false);
    useTypedEventEmitter(Modal, ModalManagerEvent.Opened, () => setOpened(true));
    // Modal can be stacked, we need to check if all dialogs are closed
    useTypedEventEmitter(Modal, ModalManagerEvent.Closed, () => !Modal.hasDialogs() && setOpened(false));
    return opened;
}

/**
 * Return true if the release announcement of the given feature is enabled
 * @param feature
 */
export function useIsReleaseAnnouncementOpen(feature: Feature): boolean {
    const modalOpened = useModalOpened();
    const releaseAnnouncementOpened = useTypedEventEmitterState(
        ReleaseAnnouncementStore.instance,
        "releaseAnnouncementChanged",
        () => ReleaseAnnouncementStore.instance.getReleaseAnnouncement() === feature,
    );

    return !modalOpened && releaseAnnouncementOpened;
}
