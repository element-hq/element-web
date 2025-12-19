/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";

import * as stories from "./RoomStatusBarView.stories.tsx";

const { WithConnectionLost, WithConsentLink, WithResourceLimit, WithUnsentMessages, WithLocalRoomRetry } =
    composeStories(stories);

describe("RoomStatusBarView", () => {
    it("renders connection lost", () => {
        const { container } = render(<WithConnectionLost />);
        expect(container).toMatchSnapshot();
    });
    it("renders resource limit error", () => {
        const { container } = render(<WithResourceLimit />);
        expect(container).toMatchSnapshot();
    });
    it("renders consent link", () => {
        const { container, getByRole } = render(<WithConsentLink />);
        expect(container).toMatchSnapshot();

        const button = getByRole("link");
        expect(button.getAttribute("href")).toEqual("#example");
    });
    it("renders unsent messages", async () => {
        const { container } = render(
            <WithUnsentMessages onDeleteAllClick={jest.fn()} onRetryRoomCreationClick={jest.fn()} />,
        );
        expect(container).toMatchSnapshot();
    });
    it("renders unsent messages and deletes all", async () => {
        const onDeleteAllClick = jest.fn();
        const { container, getByRole } = render(<WithUnsentMessages onDeleteAllClick={onDeleteAllClick} />);
        expect(container).toMatchSnapshot();

        const button = getByRole("button", { name: "Delete all" });
        await userEvent.click(button);
        expect(onDeleteAllClick).toHaveBeenCalled();
    });
    it("renders unsent messages and resends all", async () => {
        const onResendAllClick = jest.fn();
        const { container, getByRole } = render(<WithUnsentMessages onResendAllClick={onResendAllClick} />);
        expect(container).toMatchSnapshot();

        const button = getByRole("button", { name: "Retry all" });
        await userEvent.click(button);
        expect(onResendAllClick).toHaveBeenCalled();
    });
    it("renders local room error", async () => {
        const onRetryRoomCreationClick = jest.fn();
        const { container, getByRole } = render(
            <WithLocalRoomRetry onRetryRoomCreationClick={onRetryRoomCreationClick} />,
        );
        expect(container).toMatchSnapshot();

        const button = getByRole("button", { name: "Retry" });
        await userEvent.click(button);
        expect(onRetryRoomCreationClick).toHaveBeenCalled();
    });
});
