/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@test-utils";
import { describe, expect, it, vi } from "vitest";

import * as stories from "./CreateCalendarEventView.stories";

const { Default, Filled, AllDay, WithErrors, CreateFailed } = composeStories(stories);

describe("CreateCalendarEventView", () => {
    it.each([
        ["Default", Default],
        ["Filled", Filled],
        ["AllDay", AllDay],
        ["WithErrors", WithErrors],
        ["CreateFailed", CreateFailed],
    ])("renders the %s story", (_name, Story) => {
        const { container } = render(<Story />);
        expect(container).toMatchSnapshot();
    });

    it("shows the start and end times with their time zone", () => {
        render(<Default />);
        expect(screen.getByLabelText("Start")).toHaveValue("15:00");
        expect(screen.getByLabelText("End")).toHaveValue("16:00");
        expect(screen.getByText("Times are in Europe/London")).toBeInTheDocument();
    });

    it("hides the times for all-day events", () => {
        render(<AllDay />);
        expect(screen.getByRole("checkbox", { name: "All day" })).toBeChecked();
        expect(screen.queryByLabelText("Start")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("End")).not.toBeInTheDocument();
    });

    it("shows the errors from the view model", () => {
        render(<WithErrors />);
        expect(screen.getByText("Enter a title")).toBeInTheDocument();
        expect(screen.getByText("Choose a date")).toBeInTheDocument();
        expect(screen.getByText("The event must end after it starts")).toBeInTheDocument();
        expect(screen.getByText("Enter a web address starting with https:// or http://")).toBeInTheDocument();
        expect(screen.queryByText("Times are in Europe/London")).not.toBeInTheDocument();
    });

    it("shows when creating the event failed", () => {
        render(<CreateFailed />);
        expect(screen.getByRole("alert")).toHaveTextContent("Couldn't create the event. Try again.");
    });

    it("passes field changes to the view model", async () => {
        const user = userEvent.setup();
        const setTitle = vi.fn();
        const setDescription = vi.fn();
        const setDate = vi.fn();
        const setAllDay = vi.fn();
        const setStartTime = vi.fn();
        const setEndTime = vi.fn();
        const setLink = vi.fn();
        render(
            <Default
                setTitle={setTitle}
                setDescription={setDescription}
                setDate={setDate}
                setAllDay={setAllDay}
                setStartTime={setStartTime}
                setEndTime={setEndTime}
                setLink={setLink}
            />,
        );

        await user.type(screen.getByLabelText("Title"), "P");
        await user.type(screen.getByLabelText("Description"), "D");
        await user.type(screen.getByLabelText("Link"), "h");
        await user.click(screen.getByRole("checkbox", { name: "All day" }));
        // Date and time inputs do not take typed text, so set their values directly.
        fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-25" } });
        fireEvent.change(screen.getByLabelText("Start"), { target: { value: "09:00" } });
        fireEvent.change(screen.getByLabelText("End"), { target: { value: "10:30" } });

        expect(setTitle).toHaveBeenCalledWith("P");
        expect(setDescription).toHaveBeenCalledWith("D");
        expect(setLink).toHaveBeenCalledWith("h");
        expect(setAllDay).toHaveBeenCalledWith(true);
        expect(setDate).toHaveBeenCalledWith("2026-12-25");
        expect(setStartTime).toHaveBeenCalledWith("09:00");
        expect(setEndTime).toHaveBeenCalledWith("10:30");
    });

    it("creates the event when the form is submitted", () => {
        const create = vi.fn();
        render(<Filled create={create} />);

        fireEvent.submit(screen.getByLabelText("Title").closest("form")!);

        expect(create).toHaveBeenCalledTimes(1);
    });
});
