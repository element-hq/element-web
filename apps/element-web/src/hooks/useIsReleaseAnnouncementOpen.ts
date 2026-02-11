/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useState } from "react";

import { useTypedEventEmitter, useTypedEventEmitterState } from "./useEventEmitter";
import { type Feature, ReleaseAnnouncementStore } from "../stores/ReleaseAnnouncementStore";
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
