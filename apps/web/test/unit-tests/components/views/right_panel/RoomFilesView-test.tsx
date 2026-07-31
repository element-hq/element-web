/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { render, screen, fireEvent } from "jest-matrix-react";

import { RoomFilesView } from "../../../../../src/components/views/right_panel/RoomFilesView";
import { mkEvent, stubClient } from "../../../../test-utils";

// Stub TimelinePanel so we can capture the `eventFilter` predicate it is handed without rendering a real timeline.
let mockLastTimelineProps: { eventFilter?: (ev: MatrixEvent) => boolean } = {};
jest.mock("../../../../../src/components/structures/TimelinePanel", () => ({
    __esModule: true,
    default: (props: { eventFilter?: (ev: MatrixEvent) => boolean }) => {
        mockLastTimelineProps = props;
        return null;
    },
}));

const mkMedia = (msgtype: string, content: Record<string, unknown> = {}): MatrixEvent =>
    mkEvent({
        type: "m.room.message",
        user: "@me:server",
        room: "!room:server",
        content: { msgtype, body: "file", ...content },
        event: true,
    });

const renderView = (): void => {
    render(
        <RoomFilesView
            timelineSet={{} as never}
            onPaginationRequest={jest.fn()}
            empty={<div />}
            onClose={jest.fn()}
            isRoomEncrypted={false}
            onMeasurement={jest.fn()}
        />,
    );
};

describe("RoomFilesView", () => {
    beforeEach(() => {
        stubClient();
        mockLastTimelineProps = {};
    });

    it("renders the media category filters with none selected by default", () => {
        renderView();

        for (const label of ["Documents", "Images", "Videos", "Audio"]) {
            const chip = screen.getByRole("option", { name: label });
            expect(chip).toBeInTheDocument();
            expect(chip).toHaveAttribute("aria-selected", "false");
        }
    });

    it("puts the file search in the card header, alongside the close button", () => {
        renderView();

        const search = screen.getByPlaceholderText("Search files…");
        expect(search.closest(".mx_BaseCard_header")).not.toBeNull();
        expect(screen.getByTestId("base-card-close-button")).toBeInTheDocument();
    });

    it("hands TimelinePanel a predicate that shows any media but not plain text when nothing is selected", () => {
        renderView();

        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.Image))).toBe(true);
        expect(filter(mkMedia(MsgType.File))).toBe(true);
        expect(filter(mkMedia(MsgType.Text))).toBe(false);
    });

    it("narrows the predicate to the selected category", () => {
        renderView();

        fireEvent.click(screen.getByRole("option", { name: "Audio" }));

        expect(screen.getByRole("option", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.Audio))).toBe(true);
        expect(filter(mkMedia(MsgType.Audio, { "org.matrix.msc3245.voice": {} }))).toBe(true);
        expect(filter(mkMedia(MsgType.Image))).toBe(false);
    });

    it("clicking the selected category again clears the filter", () => {
        renderView();
        const documents = screen.getByRole("option", { name: "Documents" });

        fireEvent.click(documents);
        expect(documents).toHaveAttribute("aria-selected", "true");

        fireEvent.click(documents);

        expect(documents).toHaveAttribute("aria-selected", "false");
        expect(mockLastTimelineProps.eventFilter!(mkMedia(MsgType.Image))).toBe(true);
    });

    it("applies the search term to the predicate", () => {
        renderView();

        fireEvent.change(screen.getByPlaceholderText("Search files…"), { target: { value: "cat" } });

        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.Image, { body: "cat.png" }))).toBe(true);
        expect(filter(mkMedia(MsgType.Image, { body: "dog.png" }))).toBe(false);
    });

    it("combines the search term with the selected category", () => {
        renderView();

        fireEvent.change(screen.getByPlaceholderText("Search files…"), { target: { value: "cat" } });
        fireEvent.click(screen.getByRole("option", { name: "Documents" }));

        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.File, { body: "cat.pdf" }))).toBe(true);
        expect(filter(mkMedia(MsgType.Image, { body: "cat.png" }))).toBe(false);
    });

    it("moves focus between the filters with arrow, Home and End keys", () => {
        renderView();
        const documents = screen.getByRole("option", { name: "Documents" });
        const images = screen.getByRole("option", { name: "Images" });
        const audio = screen.getByRole("option", { name: "Audio" });

        documents.focus();
        fireEvent.keyDown(documents, { key: "ArrowRight" });
        expect(images).toHaveFocus();

        fireEvent.keyDown(images, { key: "ArrowLeft" });
        expect(documents).toHaveFocus();

        fireEvent.keyDown(documents, { key: "ArrowLeft" }); // wraps backwards to the last filter
        expect(audio).toHaveFocus();

        fireEvent.keyDown(audio, { key: "Home" });
        expect(documents).toHaveFocus();

        fireEvent.keyDown(documents, { key: "End" });
        expect(audio).toHaveFocus();
    });
});
