/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./ElementCallMockView.stories.tsx";

const { Lobby, InCall, WithoutClose, UnknownRoom } = composeStories(stories);

describe("ElementCallMockView", () => {
    it("renders the lobby", () => {
        const { container } = render(<Lobby />);
        expect(screen.getByRole("region", { name: "Element Call (mock)" })).toBeInTheDocument();
        expect(screen.getByText("No one is in this call")).toBeInTheDocument();
        expect(screen.getByText(/in lobby/)).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders the call with its participants, mute state and log", () => {
        const { container } = render(<InCall />);
        expect(screen.getByText("@alice:example.org (ALICEDEVICE) – you")).toBeInTheDocument();
        expect(screen.getByText(/in call/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "notifyHungUp" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Unmute audio" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "setAlwaysOnScreen(false)" })).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "HostBridge log" })).toHaveTextContent("← hangUp");
        expect(container).toMatchSnapshot();
    });

    it("calls the actions from its buttons", async () => {
        const user = userEvent.setup();
        const toggleJoined = vi.fn(async () => {});
        const toggleAudio = vi.fn(async () => {});
        const close = vi.fn(async () => {});
        render(<Lobby toggleJoined={toggleJoined} toggleAudio={toggleAudio} close={close} />);

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        expect(toggleJoined).toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Mute audio" }));
        expect(toggleAudio).toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(close).toHaveBeenCalled();
    });

    it("has no close button when the host offers no close", () => {
        render(<WithoutClose />);
        expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
        expect(screen.getByText(/close: No/)).toBeInTheDocument();
    });

    it("renders only an error for an unknown room", () => {
        const { container } = render(<UnknownRoom />);
        expect(screen.getByRole("region", { name: "Element Call (mock)" })).toBeInTheDocument();
        expect(screen.getByText("Unknown room !unknown:example.org")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
