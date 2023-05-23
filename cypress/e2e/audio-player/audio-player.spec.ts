/*
Copyright 2023 Suguru Hirahara

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

/// <reference types="cypress" />

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";

describe("Audio player", () => {
    let homeserver: HomeserverInstance;
    const TEST_USER = "Hanako";

    const percyCSS =
        // FIXME: hide mx_SeekBar because flaky - see https://github.com/vector-im/element-web/issues/24898
        ".mx_SeekBar, " +
        // Exclude various components from the snapshot, for consistency
        ".mx_JumpToBottomButton, " +
        ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

    const uploadFile = (file: string) => {
        // Upload a file from the message composer
        cy.get(".mx_MessageComposer_actions input[type='file']").selectFile(file, { force: true });

        cy.get(".mx_Dialog").within(() => {
            // Find and click primary "Upload" button
            cy.findByRole("button", { name: "Upload" }).click();
        });

        // Wait until the file is sent
        cy.get(".mx_RoomView_statusArea_expanded").should("not.exist");
        cy.get(".mx_EventTile.mx_EventTile_last .mx_EventTile_receiptSent").should("exist");
    };

    /**
     * Take snapshots of mx_EventTile_last on each layout, outputting log for reference/debugging.
     * @param detail The Percy snapshot name. Used for outputting logs too.
     * @param monospace This changes the font used to render the UI from a default one to a monospace one.
     * Set to false by default. Note that the font applied to Percy snapshots can be different from the test result
     * on your local environment.
     */
    const takeSnapshots = (detail: string, monospace = false) => {
        // Check that the audio player is rendered and its button becomes visible
        const checkPlayerVisibility = () => {
            // Assert that the audio player and media information are visible
            cy.get(".mx_EventTile_mediaLine .mx_MAudioBody .mx_AudioPlayer_container .mx_AudioPlayer_mediaInfo").within(
                () => {
                    cy.contains(".mx_AudioPlayer_mediaName", ".ogg").should("be.visible"); // extension
                    cy.contains(".mx_AudioPlayer_byline", "00:01").should("be.visible");
                    cy.contains(".mx_AudioPlayer_byline", "(3.56 KB)").should("be.visible"); // actual size
                },
            );

            // Assert that the play button can be found and is visible
            cy.findByRole("button", { name: "Play" }).should("be.visible");

            if (monospace) {
                // Assert that the monospace timer is visible
                cy.get("[role='timer']").should("have.css", "font-family", '"monospace"').should("be.visible");
            }
        };

        /**
         * Define snapshot widths of selected EventTile, on which the audio player is rendered
         *
         * 50px (magic number): narrow enough EventTile to be compressed to check a11y
         * 267px: EventTile on IRC and modern/group layout, on which the player is rendered in its full width
         * 285px: EventTile on bubble layout, on which the player is rendered in its full width
         */
        const snapshotWidthsIRC = [50, 267];
        const snapshotWidthsGroup = snapshotWidthsIRC;
        const snapshotWidthsBubble = [50, 285];

        if (monospace) {
            // Enable system font and monospace setting
            cy.setSettingValue("useSystemFont", null, SettingLevel.DEVICE, true);
            cy.setSettingValue("systemFont", null, SettingLevel.DEVICE, "monospace");
        }

        // Check the status of the seek bar
        // TODO: check if visible - currently checking its visibility on a compressed EventTile returns an error
        cy.get(".mx_AudioPlayer_seek input[type='range']").should("exist");

        // Enable IRC layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

        cy.get(".mx_EventTile_last[data-layout='irc']").within(() => {
            // Click the event timestamp to highlight EventTile in case it is not visible
            cy.get(".mx_MessageTimestamp").click();

            // Assert that rendering of the player settled and the play button is visible before taking a snapshot
            checkPlayerVisibility();
        });

        // Take a snapshot of mx_EventTile_last on IRC layout
        cy.get(".mx_EventTile_last").percySnapshotElement(detail + " on IRC layout", {
            percyCSS,
            widths: snapshotWidthsIRC,
        });

        // Output a log
        cy.log("Took a snapshot of " + detail + " on IRC layout");

        // Take a snapshot on modern/group layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
        cy.get(".mx_EventTile_last[data-layout='group']").within(() => {
            cy.get(".mx_MessageTimestamp").click();
            checkPlayerVisibility();
        });
        cy.get(".mx_EventTile_last").percySnapshotElement(detail + " on modern/group layout", {
            percyCSS,
            widths: snapshotWidthsGroup,
        });
        cy.log("Took a snapshot of " + detail + " on modern/group layout");

        // Take a snapshot on bubble layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        cy.get(".mx_EventTile_last[data-layout='bubble']").within(() => {
            cy.get(".mx_MessageTimestamp").click();
            checkPlayerVisibility();
        });
        cy.get(".mx_EventTile_last").percySnapshotElement(detail + " on bubble layout", {
            percyCSS,
            widths: snapshotWidthsBubble,
        });
        cy.log("Took a snapshot of " + detail + " on bubble layout");
    };

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, TEST_USER);
        });

        cy.createRoom({ name: "Test Room" }).viewRoomByName("Test Room");

        // Wait until configuration is finished
        cy.get(".mx_GenericEventListSummary[data-layout='group'] .mx_GenericEventListSummary_summary").within(() => {
            cy.findByText(TEST_USER + " created and configured the room.").should("exist");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be correctly rendered - light theme", () => {
        uploadFile("cypress/fixtures/1sec-long-name-audio-file.ogg");

        takeSnapshots("Selected EventTile of audio player (light theme)");
    });

    it("should be correctly rendered - light theme with monospace font", () => {
        uploadFile("cypress/fixtures/1sec-long-name-audio-file.ogg");

        takeSnapshots("Selected EventTile of audio player (light theme, monospace font)", true); // Enable monospace
    });

    it("should be correctly rendered - high contrast theme", () => {
        // Disable system theme in case ThemeWatcher enables the theme automatically,
        // so that the high contrast theme can be enabled
        cy.setSettingValue("use_system_theme", null, SettingLevel.DEVICE, false);

        // Enable high contrast manually
        cy.openUserSettings("Appearance")
            .findByTestId("mx_ThemeChoicePanel")
            .findByLabelText("Use high contrast")
            .click({ force: true }); // force click because the size of the checkbox is zero

        cy.closeDialog();

        uploadFile("cypress/fixtures/1sec-long-name-audio-file.ogg");

        takeSnapshots("Selected EventTile of audio player (high contrast)");
    });

    it("should be correctly rendered - dark theme", () => {
        // Enable dark theme
        cy.setSettingValue("theme", null, SettingLevel.ACCOUNT, "dark");

        uploadFile("cypress/fixtures/1sec-long-name-audio-file.ogg");

        takeSnapshots("Selected EventTile of audio player (dark theme)");
    });

    it("should play an audio file", () => {
        uploadFile("cypress/fixtures/1sec.ogg");

        // Assert that the audio player is rendered
        cy.get(".mx_EventTile_last .mx_EventTile_mediaLine .mx_MAudioBody .mx_AudioPlayer_container").within(() => {
            // Assert that the counter is zero before clicking the play button
            cy.contains(".mx_AudioPlayer_seek [role='timer']", "00:00").should("exist");

            // Find and click "Play" button, the wait is to make the test less flaky
            cy.findByRole("button", { name: "Play" }).should("exist");
            cy.wait(500).findByRole("button", { name: "Play" }).click();

            // Assert that "Pause" button can be found
            cy.findByRole("button", { name: "Pause" }).should("exist");

            // Assert that the timer is reset when the audio file finished playing
            cy.contains(".mx_AudioPlayer_seek [role='timer']", "00:00").should("exist");

            // Assert that "Play" button can be found
            cy.findByRole("button", { name: "Play" }).should("exist");
        });
    });

    it("should support downloading an audio file", () => {
        uploadFile("cypress/fixtures/1sec.ogg");

        // Find and click "Download" button on MessageActionBar
        cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Download" }).click();

        // Assert that the file was downloaded
        cy.readFile("cypress/downloads/1sec.ogg").should("exist");
    });

    it("should support replying to audio file with another audio file", () => {
        uploadFile("cypress/fixtures/1sec.ogg");

        // Assert the audio player is rendered
        cy.get(".mx_EventTile_last .mx_AudioPlayer_container").should("exist");

        // Find and click "Reply" button on MessageActionBar
        cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Reply" }).click();

        // Reply to the player with another audio file
        uploadFile("cypress/fixtures/1sec.ogg");

        cy.get(".mx_EventTile_last").within(() => {
            // Assert that the audio player is rendered
            cy.get(".mx_AudioPlayer_container").should("exist");

            // Assert that replied audio file is rendered as file button inside ReplyChain
            cy.get(".mx_ReplyChain_wrapper .mx_MFileBody_info[role='button']").within(() => {
                // Assert that the file button has file name
                cy.get(".mx_MFileBody_info_filename").should("exist");
            });
        });

        // Take snapshots
        takeSnapshots("Selected EventTile of audio player with a reply");
    });

    it("should support creating a reply chain with multiple audio files", () => {
        // Note: "mx_ReplyChain" element is used not only for replies which
        // create a reply chain, but also for a single reply without a replied
        // message. This test checks whether a reply chain which consists of
        // multiple audio file replies is rendered properly.

        // Find and click "Reply" button
        const clickButtonReply = () => {
            cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Reply" }).click();
        };

        uploadFile("cypress/fixtures/upload-first.ogg");

        // Assert that the audio player is rendered
        cy.get(".mx_EventTile_last .mx_AudioPlayer_container").should("exist");

        clickButtonReply();

        // Reply to the player with another audio file
        uploadFile("cypress/fixtures/upload-second.ogg");

        // Assert that the audio player is rendered
        cy.get(".mx_EventTile_last .mx_AudioPlayer_container").should("exist");

        clickButtonReply();

        // Reply to the player with yet another audio file to create a reply chain
        uploadFile("cypress/fixtures/upload-third.ogg");

        cy.get(".mx_EventTile_last").within(() => {
            // Assert that the audio player is rendered
            cy.get(".mx_AudioPlayer_container").should("exist");

            // Assert that there are two "mx_ReplyChain" elements
            cy.get(".mx_ReplyChain").should("have.length", 2);

            // Assert that one line contains the user name
            cy.get(".mx_ReplyChain .mx_ReplyTile_sender").within(() => {
                cy.findByText(TEST_USER);
            });

            // Assert that the other line contains the file button
            cy.get(".mx_ReplyChain .mx_MFileBody").should("exist");

            // Click "In reply to"
            cy.contains(".mx_ReplyChain .mx_ReplyChain_show", "In reply to").click();

            cy.get("blockquote.mx_ReplyChain:first-of-type").within(() => {
                // Assert that "In reply to" has disappeared
                cy.findByText("In reply to").should("not.exist");

                // Assert that audio file on the first row is rendered as file button
                cy.get(".mx_MFileBody_info[role='button']").within(() => {
                    // Assert that the file button contains the name of the file sent at first
                    cy.contains(".mx_MFileBody_info_filename", "upload-first.ogg");
                });
            });
        });

        // Take snapshots
        takeSnapshots("Selected EventTile of audio player with a reply chain");
    });

    it("should be rendered, play, and support replying on a thread", () => {
        uploadFile("cypress/fixtures/1sec-long-name-audio-file.ogg");

        // On the main timeline
        cy.get(".mx_RoomView_MessageList").within(() => {
            // Assert the audio player is rendered
            cy.get(".mx_EventTile_last .mx_AudioPlayer_container").should("exist");

            // Find and click "Reply in thread" button
            cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Reply in thread" }).click();
        });

        // On a thread
        cy.get(".mx_ThreadView").within(() => {
            cy.get(".mx_EventTile_last").within(() => {
                // Assert that the player is correctly rendered on a thread
                cy.get(".mx_EventTile_mediaLine .mx_MAudioBody .mx_AudioPlayer_container").within(() => {
                    // Assert that the counter is zero before clicking the play button
                    cy.contains(".mx_AudioPlayer_seek [role='timer']", "00:00").should("exist");

                    // Find and click "Play" button, the wait is to make the test less flaky
                    cy.findByRole("button", { name: "Play" }).should("exist");
                    cy.wait(500).findByRole("button", { name: "Play" }).click();

                    // Assert that "Pause" button can be found
                    cy.findByRole("button", { name: "Pause" }).should("exist");

                    // Assert that the timer is reset when the audio file finished playing
                    cy.contains(".mx_AudioPlayer_seek [role='timer']", "00:00").should("exist");

                    // Assert that "Play" button can be found
                    cy.findByRole("button", { name: "Play" }).should("exist").should("not.have.attr", "disabled");
                });
            });

            // Find and click "Reply" button
            //
            // Calling cy.get(".mx_EventTile_last") again here is a workaround for
            // https://github.com/matrix-org/matrix-js-sdk/issues/3394: the event tile may have been re-mounted while
            // the audio was playing.
            cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Reply" }).click();

            cy.get(".mx_MessageComposer--compact").within(() => {
                // Assert that the reply preview is rendered on the message composer
                cy.get(".mx_ReplyPreview").within(() => {
                    // Assert that the reply preview contains audio ReplyTile the file info button
                    cy.get(".mx_ReplyTile_audio .mx_MFileBody_info[role='button']").should("exist");
                });

                // Select :smile: emoji and send it
                cy.findByTestId("basicmessagecomposer").type(":smile:");
                cy.get(".mx_Autocomplete_Completion[aria-selected='true']").click();
                cy.findByTestId("basicmessagecomposer").type("{enter}");
            });

            cy.get(".mx_EventTile_last").within(() => {
                // Assert that the file name is rendered on the file button
                cy.get(".mx_ReplyTile_audio .mx_MFileBody_info[role='button']").should("exist");
            });
        });
    });
});
