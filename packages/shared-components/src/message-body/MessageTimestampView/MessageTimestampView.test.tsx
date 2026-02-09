/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen, fireEvent } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, afterEach, expect } from "vitest";

import * as stories from "./MessageTimestampView.stories.tsx";
import {
    MessageTimestampView,
    type MessageTimestampViewActions,
    type MessageTimestampViewSnapshot,
} from "./MessageTimestampView";
import { MockViewModel } from "../../viewmodel/MockViewModel.ts";
import { I18nContext } from "../../utils/i18nContext.ts";
import { I18nApi } from "../../index.ts";

const { Default, HasTsReceivedAt, HasHref, HasInhibitTooltip, HasExtraClassNames, HasActions } =
    composeStories(stories);

const renderWithI18n = (ui: React.ReactElement): ReturnType<typeof render> =>
    render(ui, {
        wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
    });

describe("MessageTimestampView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders the message timestamp in default state", async () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with received timestamp", async () => {
        const { container } = render(<HasTsReceivedAt />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with extra class names", async () => {
        const { container } = render(<HasExtraClassNames />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with inhibit tooltip", async () => {
        const { container } = render(<HasInhibitTooltip />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with href", async () => {
        const { container } = render(<HasHref />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with actions", async () => {
        const { container } = render(<HasActions />);
        expect(container).toMatchSnapshot();
    });

    const onClick = vi.fn((event: React.MouseEvent<HTMLElement>) => event.preventDefault());
    const onContextMenu = vi.fn((event: React.MouseEvent<HTMLElement>) => event.preventDefault());

    class MessageTimestampViewModel
        extends MockViewModel<MessageTimestampViewSnapshot>
        implements MessageTimestampViewActions
    {
        public onClick = onClick;
        public onContextMenu = onContextMenu;
    }

    it("should attach vm methods with href", async () => {
        const vm = new MessageTimestampViewModel({
            ts: "04:58",
            tsSentAt: "Thu, 17 Nov 2022, 4:58:32 pm",
            href: "~",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByRole("link");

        fireEvent.click(target);
        expect(onClick).toHaveBeenCalled();

        fireEvent.contextMenu(target);
        expect(onContextMenu).toHaveBeenCalled();
    });

    it("should attach vm methods without href", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "04:58",
            tsSentAt: "Thu, 17 Nov 2022, 4:58:32 pm",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByRole("link", { hidden: true });

        await user.click(target);
        expect(onClick).toHaveBeenCalled();

        await user.pointer({ target, keys: "[MouseRight]" });
        expect(onContextMenu).toHaveBeenCalled();
    });

    it("should show full date & time on hover", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "08:09",
            tsSentAt: "Fri, Dec 17, 2021, 08:09:00",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        await user.hover(screen.getByRole("link"));
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(`"Fri, Dec 17, 2021, 08:09:00"`);
    });

    it("should show sent & received time on hover if passed", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "08:09",
            tsSentAt: "Fri, Dec 17, 2021, 08:09:00",
            tsReceivedAt: "Received at: Sat, Dec 18, 2021, 08:09:00",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        await user.hover(screen.getByRole("link"));
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(
            `"Sent at: Fri, Dec 17, 2021, 08:09:00Received at: Received at: Sat, Dec 18, 2021, 08:09:00"`,
        );
    });

    it("handles keyboard activation on span when click handler is set", async () => {
        const vm = new MessageTimestampViewModel({
            ts: "12:34",
            tsSentAt: "Mon, Jan 1, 2024, 12:34:00",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByRole("link");
        fireEvent.keyDown(target, { key: "Enter" });
        fireEvent.keyDown(target, { key: " " });

        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it("ignores other keys when click handler is set", async () => {
        const vm = new MessageTimestampViewModel({
            ts: "13:14",
            tsSentAt: "Tue, Jun 6, 2023, 13:14:00",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByRole("link");
        fireEvent.keyDown(target, { key: "Escape" });

        expect(onClick).not.toHaveBeenCalled();
    });

    it("ignores keyboard activation when no click handler is provided", async () => {
        const vm = new MessageTimestampViewModelNoActions({
            ts: "15:16",
            tsSentAt: "Wed, Jul 7, 2021, 15:16:00",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByText("15:16");
        fireEvent.keyDown(target, { key: "Enter" });

        expect(onClick).not.toHaveBeenCalled();
    });

    it("does not wrap tooltip labels when received timestamp is empty", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "09:10",
            tsSentAt: "Tue, Feb 2, 2021, 09:10:00",
            tsReceivedAt: "",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        await user.hover(screen.getByRole("link"));
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(`"Tue, Feb 2, 2021, 09:10:00"`);
    });

    class MessageTimestampViewModelNoActions extends MockViewModel<MessageTimestampViewSnapshot> {}

    it("renders without tooltip when inhibited and no click handler is provided", async () => {
        const vm = new MessageTimestampViewModelNoActions({
            ts: "07:08",
            tsSentAt: "Wed, Mar 3, 2021, 07:08:00",
            inhibitTooltip: true,
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByText("07:08");
        expect(target).toHaveAttribute("aria-hidden", "true");
        expect(target).not.toHaveAttribute("role");
        expect(target).not.toHaveAttribute("tabindex");
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("keeps link semantics when inhibited but click handler exists", async () => {
        const vm = new MessageTimestampViewModel({
            ts: "11:12",
            tsSentAt: "Thu, Apr 4, 2024, 11:12:00",
            inhibitTooltip: true,
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByRole("link");
        expect(target).toHaveAttribute("aria-hidden", "false");
        expect(target).toHaveAttribute("tabindex", "0");
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("exposes focusable span when tooltip is enabled without click handler", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModelNoActions({
            ts: "03:04",
            tsSentAt: "Fri, May 5, 2023, 03:04:00",
        });

        renderWithI18n(<MessageTimestampView vm={vm} />);

        const target = screen.getByText("03:04");
        expect(target).toHaveAttribute("aria-hidden", "false");
        expect(target).toHaveAttribute("tabindex", "0");
        expect(target).not.toHaveAttribute("role");

        await user.hover(target);
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(`"Fri, May 5, 2023, 03:04:00"`);
    });
});
