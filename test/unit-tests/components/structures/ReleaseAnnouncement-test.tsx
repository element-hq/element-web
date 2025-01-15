/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, render, screen, waitFor } from "jest-matrix-react";

import { ReleaseAnnouncement } from "../../../../src/components/structures/ReleaseAnnouncement";
import Modal, { ModalManagerEvent } from "../../../../src/Modal";
import { ReleaseAnnouncementStore } from "../../../../src/stores/ReleaseAnnouncementStore";

describe("ReleaseAnnouncement", () => {
    beforeEach(async () => {
        // Reset the singleton instance of the ReleaseAnnouncementStore
        // @ts-ignore
        ReleaseAnnouncementStore.internalInstance = new ReleaseAnnouncementStore();
    });

    function renderReleaseAnnouncement() {
        return render(
            <ReleaseAnnouncement
                feature="threadsActivityCentre"
                header="header"
                description="description"
                closeLabel="close"
            >
                <div>content</div>
            </ReleaseAnnouncement>,
        );
    }

    test("render the release announcement and close it", async () => {
        renderReleaseAnnouncement();

        // The release announcement is displayed
        expect(screen.queryByRole("dialog", { name: "header" })).toBeVisible();
        // Click on the close button in the release announcement
        screen.getByRole("button", { name: "close" }).click();
        // The release announcement should be hidden after the close button is clicked
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "header" })).toBeNull());
    });

    test("when a dialog is opened, the release announcement should not be displayed", async () => {
        renderReleaseAnnouncement();
        // The release announcement is displayed
        expect(screen.queryByRole("dialog", { name: "header" })).toBeVisible();

        // Open a dialog
        act(() => {
            Modal.emit(ModalManagerEvent.Opened);
        });
        // The release announcement should be hidden after the dialog is opened
        expect(screen.queryByRole("dialog", { name: "header" })).toBeNull();

        // Close the dialog
        act(() => {
            Modal.emit(ModalManagerEvent.Closed);
        });
        // The release announcement should be displayed after the dialog is closed
        expect(screen.queryByRole("dialog", { name: "header" })).toBeVisible();
    });
});
