/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
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

const { Default, HasTsReceivedAt, HasHref, HasInhibitTooltip, HasExtraClassNames } = composeStories(stories);

describe("MessageTimestampView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders the message timestamp in default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with received timestamp", () => {
        const { container } = render(<HasTsReceivedAt />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with extra class names", () => {
        const { container } = render(<HasInhibitTooltip />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with inhibit tooltip", () => {
        const { container } = render(<HasExtraClassNames />);
        expect(container).toMatchSnapshot();
    });

    it("renders the message timestamp with href", () => {
        const { container } = render(<HasHref />);
        expect(container).toMatchSnapshot();
    });

    const onClick = vi.fn((event: React.MouseEvent<HTMLElement>) => event.preventDefault());
    const onContextMenu = vi.fn();

    class MessageTimestampViewModel
        extends MockViewModel<MessageTimestampViewSnapshot>
        implements MessageTimestampViewActions
    {
        public onClick = onClick;
        public onContextMenu = onContextMenu;
    }

    it("should attach vm methods with href", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "04:58",
            tsSentAt: "Thu, 17 Nov 2022, 4:58:32 pm",
            href: "~",
        });

        render(<MessageTimestampView vm={vm} />, {
            wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
        });

        const target = screen.getByRole("button");

        await user.click(target);
        expect(onClick).toHaveBeenCalled();

        await user.pointer({ target, keys: "[MouseRight]" });
        expect(onContextMenu).toHaveBeenCalled();
    });

    it("should attach vm methods without href", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "04:58",
            tsSentAt: "Thu, 17 Nov 2022, 4:58:32 pm",
        });

        render(<MessageTimestampView vm={vm} />, {
            wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
        });

        const target = screen.getByRole("button", { hidden: true });

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

        render(<MessageTimestampView vm={vm} />, {
            wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
        });

        await user.hover(screen.getByRole("button"));
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(`"Fri, Dec 17, 2021, 08:09:00"`);
    });

    it("should show sent & received time on hover if passed", async () => {
        const user = userEvent.setup();
        const vm = new MessageTimestampViewModel({
            ts: "08:09",
            tsSentAt: "Fri, Dec 17, 2021, 08:09:00",
            tsReceivedAt: "Received at: Sat, Dec 18, 2021, 08:09:00",
        });

        render(<MessageTimestampView vm={vm} />, {
            wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
        });

        await user.hover(screen.getByRole("button"));
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(
            `"Sent at: Fri, Dec 17, 2021, 08:09:00Received at: Received at: Sat, Dec 18, 2021, 08:09:00"`,
        );
    });
});
