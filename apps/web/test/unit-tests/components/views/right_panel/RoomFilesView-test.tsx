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
    render(<RoomFilesView timelineSet={{} as never} onPaginationRequest={jest.fn()} empty={<div />} />);
};

describe("RoomFilesView", () => {
    beforeEach(() => {
        stubClient();
        mockLastTimelineProps = {};
    });

    it("renders the media tabs with All selected by default", () => {
        renderView();

        for (const label of ["All", "Media", "Files", "Music", "Voice"]) {
            expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
        }
        expect(screen.getByRole("option", { name: "All" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("option", { name: "Voice" })).toHaveAttribute("aria-selected", "false");
    });

    it("hands TimelinePanel a predicate that shows any media but not plain text under All", () => {
        renderView();

        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.Image))).toBe(true);
        expect(filter(mkMedia(MsgType.Text))).toBe(false);
    });

    it("narrows the predicate to the selected tab", () => {
        renderView();

        fireEvent.click(screen.getByRole("option", { name: "Voice" }));

        expect(screen.getByRole("option", { name: "Voice" })).toHaveAttribute("aria-selected", "true");
        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.Audio, { "org.matrix.msc3245.voice": {} }))).toBe(true);
        expect(filter(mkMedia(MsgType.Image))).toBe(false);
        expect(filter(mkMedia(MsgType.Audio))).toBe(false); // music, not voice
    });

    it("applies the in-tab search term to the predicate", () => {
        renderView();

        fireEvent.change(screen.getByPlaceholderText("Search by file name"), { target: { value: "cat" } });

        const filter = mockLastTimelineProps.eventFilter!;
        expect(filter(mkMedia(MsgType.Image, { body: "cat.png" }))).toBe(true);
        expect(filter(mkMedia(MsgType.Image, { body: "dog.png" }))).toBe(false);
    });

    it("moves focus between tabs with arrow, Home and End keys", () => {
        renderView();
        const all = screen.getByRole("option", { name: "All" });
        const media = screen.getByRole("option", { name: "Media" });
        const voice = screen.getByRole("option", { name: "Voice" });

        all.focus();
        fireEvent.keyDown(all, { key: "ArrowRight" });
        expect(media).toHaveFocus();

        fireEvent.keyDown(media, { key: "ArrowLeft" });
        expect(all).toHaveFocus();

        fireEvent.keyDown(all, { key: "ArrowLeft" }); // wraps backwards to the last tab
        expect(voice).toHaveFocus();

        fireEvent.keyDown(voice, { key: "Home" });
        expect(all).toHaveFocus();

        fireEvent.keyDown(all, { key: "End" });
        expect(voice).toHaveFocus();
    });
});
