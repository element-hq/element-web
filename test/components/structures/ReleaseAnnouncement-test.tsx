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

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { ReleaseAnnouncement } from "../../../src/components/structures/ReleaseAnnouncement";
import Modal, { ModalManagerEvent } from "../../../src/Modal";
import { ReleaseAnnouncementStore } from "../../../src/stores/ReleaseAnnouncementStore";

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
