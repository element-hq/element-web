/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    MjolnirBodyView,
    type MjolnirBodyViewActions,
    type MjolnirBodyViewModel,
    type MjolnirBodyViewSnapshot,
} from "./MjolnirBodyView";
import * as stories from "./MjolnirBodyView.stories";

const { Default } = composeStories(stories);

class TestMjolnirBodyViewModel extends MockViewModel<MjolnirBodyViewSnapshot> implements MjolnirBodyViewActions {
    public constructor(
        snapshot: MjolnirBodyViewSnapshot,
        public onAllowClick: MjolnirBodyViewActions["onAllowClick"],
    ) {
        super(snapshot);
    }
}

describe("MjolnirBodyView", () => {
    it("renders the default story", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText(/You have ignored this user, so their message is hidden\./)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Show anyways." })).toBeInTheDocument();
    });

    it("invokes the allow action", async () => {
        const user = userEvent.setup();
        const onAllowClick = vi.fn();
        const vm = new TestMjolnirBodyViewModel({}, onAllowClick) as MjolnirBodyViewModel;

        render(<MjolnirBodyView vm={vm} />);

        await user.click(screen.getByRole("button", { name: "Show anyways." }));

        expect(onAllowClick).toHaveBeenCalledTimes(1);
    });

    it("applies a custom className to the root element", () => {
        const vm = new TestMjolnirBodyViewModel({}, vi.fn()) as MjolnirBodyViewModel;

        const { container } = render(<MjolnirBodyView vm={vm} className="custom-mjolnir" />);

        expect(container.firstChild).toHaveClass("custom-mjolnir");
    });

    it("forwards the provided ref to the root element", () => {
        const ref = React.createRef<HTMLDivElement>();
        const vm = new TestMjolnirBodyViewModel({}, vi.fn()) as MjolnirBodyViewModel;

        render(<MjolnirBodyView vm={vm} ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
});
