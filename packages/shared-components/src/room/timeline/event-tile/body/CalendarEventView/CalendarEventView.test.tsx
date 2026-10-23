/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import { describe, expect, it } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel/MockViewModel";
import { CalendarEventView, type CalendarEventViewModel, type CalendarEventViewSnapshot } from "./CalendarEventView";
import * as stories from "./CalendarEventView.stories";

const {
    Default,
    AllDay,
    Recurring,
    WithDetails,
    WithLink,
    WithCallLink,
    InvitedYou,
    Scheduled,
    WithoutDateBadge,
    Tentative,
    Cancelled,
    Untitled,
} = composeStories(stories);

const renderView = (snapshot: CalendarEventViewSnapshot): ReturnType<typeof render> =>
    render(<CalendarEventView vm={new MockViewModel(snapshot) as CalendarEventViewModel} />);

describe("CalendarEventView", () => {
    it.each([
        ["Default", Default],
        ["AllDay", AllDay],
        ["Recurring", Recurring],
        ["WithDetails", WithDetails],
        ["WithLink", WithLink],
        ["WithCallLink", WithCallLink],
        ["InvitedYou", InvitedYou],
        ["Tentative", Tentative],
        ["Cancelled", Cancelled],
    ])("renders the %s story", (_name, Story) => {
        const { container } = render(<Story />);
        expect(container).toMatchSnapshot();
    });

    it("renders the date, time and time zone", () => {
        render(<Default />);
        expect(screen.getByText("Some event")).toBeInTheDocument();
        expect(screen.getByText("Wednesday, 15 January 2020 · 13:00 – 14:00")).toBeInTheDocument();
        expect(screen.getByText("America/New_York")).toBeInTheDocument();
        expect(screen.queryByText("Tentative")).not.toBeInTheDocument();
        expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    });

    it("shows the start month and day in a badge hidden from screen readers", () => {
        render(<AllDay />);
        const month = screen.getByText("Dec");
        expect(screen.getByText("25")).toBeInTheDocument();
        expect(month.parentElement).toHaveAttribute("aria-hidden", "true");
    });

    it("hides the date badge without a start month and day", () => {
        render(<WithoutDateBadge />);
        expect(screen.queryByText("Jan")).not.toBeInTheDocument();
        expect(screen.getByText("Wednesday, 15 January 2020 · 13:00 – 14:00")).toBeInTheDocument();
    });

    it("names the sender who invited you", () => {
        render(<InvitedYou />);
        expect(screen.getByText("Alice").parentElement).toHaveTextContent("Alice invited you");
    });

    it("names the sender who scheduled the event", () => {
        render(<Scheduled />);
        expect(screen.getByText("Alice").parentElement).toHaveTextContent("Alice scheduled an event");
    });

    it("omits the sender line without a sender", () => {
        render(<Default />);
        expect(screen.queryByText(/invited you|scheduled an event/)).not.toBeInTheDocument();
    });

    it("labels events without a time as all day", () => {
        render(<AllDay />);
        expect(screen.getByText("Friday, 25 December 2026 · All day")).toBeInTheDocument();
    });

    it("falls back to a generic title for untitled events", () => {
        render(<Untitled />);
        expect(screen.getByText("Untitled event")).toBeInTheDocument();
    });

    it("shows the status badge", () => {
        const { unmount } = render(<Tentative />);
        expect(screen.getByText("Tentative")).toBeInTheDocument();
        unmount();

        render(<Cancelled />);
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("renders locations, link buttons and the participant count", () => {
        render(<WithDetails />);
        expect(screen.getByText("Meeting room 2, London office")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Open link" })).toHaveAttribute("href", "https://example.org/planning");
        expect(screen.getByRole("link", { name: "Join call" })).toHaveAttribute(
            "href",
            "https://call.element.io/room/#/planning",
        );
        expect(screen.getByText("1 participant")).toBeInTheDocument();
    });

    it("renders only the link button when there is no call", () => {
        render(<WithLink />);
        expect(screen.getByRole("link", { name: "Open link" })).toHaveAttribute("target", "_blank");
        expect(screen.queryByRole("link", { name: "Join call" })).not.toBeInTheDocument();
    });

    it("renders only the join call button when there is no link", () => {
        render(<WithCallLink />);
        expect(screen.getByRole("link", { name: "Join call" })).toHaveAttribute("target", "_blank");
        expect(screen.queryByRole("link", { name: "Open link" })).not.toBeInTheDocument();
    });

    it("pluralises the participant count", () => {
        render(<Recurring />);
        expect(screen.getByText("6 participants")).toBeInTheDocument();
        expect(screen.getByText("Every weekday")).toBeInTheDocument();
    });

    it("hides optional details when they are absent", () => {
        renderView({ title: "Minimal", date: "Monday, 1 June 2026", participantCount: 0 });
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(screen.queryByText(/participant/)).not.toBeInTheDocument();
    });
});
