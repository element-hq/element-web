/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import { EncryptionEventState, EncryptionEventView } from "./EncryptionEventView";
import * as stories from "./EncryptionEventView.stories";
import { MockViewModel } from "../../viewmodel";

const {
    Default,
    StateEncryptionEnabled,
    ParametersChanged,
    DisableAttempt,
    EnabledDirectMessage,
    EnabledLocalRoom,
    Unsupported,
    WithTimestamp,
} = composeStories(stories);

describe("EncryptionEventView", () => {
    const renderView = (
        state: EncryptionEventState,
        encryptedStateEvents?: boolean,
        userName?: string,
        className?: string,
    ): void => {
        const vm = new MockViewModel({
            state,
            encryptedStateEvents,
            userName,
            className,
        });
        render(<EncryptionEventView vm={vm} />);
    };

    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders StateEncryptionEnabled story", () => {
        const { container } = render(<StateEncryptionEnabled />);
        expect(container).toMatchSnapshot();
    });

    it("renders ParametersChanged story", () => {
        const { container } = render(<ParametersChanged />);
        expect(container).toMatchSnapshot();
    });

    it("renders DisableAttempt story", () => {
        const { container } = render(<DisableAttempt />);
        expect(container).toMatchSnapshot();
    });

    it("renders EnabledDirectMessage story", () => {
        const { container } = render(<EnabledDirectMessage />);
        expect(container).toMatchSnapshot();
    });

    it("renders EnabledLocalRoom story", () => {
        const { container } = render(<EnabledLocalRoom />);
        expect(container).toMatchSnapshot();
    });

    it("renders Unsupported story", () => {
        const { container } = render(<Unsupported />);
        expect(container).toMatchSnapshot();
    });

    it("renders WithTimestamp story", () => {
        const { container } = render(<WithTimestamp />);
        expect(container).toMatchSnapshot();
    });

    it("shows enabled room encryption copy", () => {
        renderView(EncryptionEventState.ENABLED);

        expect(screen.getByText("Encryption enabled")).toBeInTheDocument();
        expect(
            screen.getByText(
                "Messages in this room are end-to-end encrypted. When people join, you can verify them in their profile, just tap on their profile picture.",
            ),
        ).toBeInTheDocument();
    });

    it("shows enabled state encryption copy", () => {
        renderView(EncryptionEventState.ENABLED, true);

        expect(screen.getByText("Experimental state encryption enabled")).toBeInTheDocument();
        expect(
            screen.getByText(
                "Messages and state events in this room are end-to-end encrypted. When people join, you can verify them in their profile, just tap on their profile picture.",
            ),
        ).toBeInTheDocument();
    });

    it("shows changed encryption parameters copy", () => {
        renderView(EncryptionEventState.CHANGED);

        expect(screen.getByText("Encryption enabled")).toBeInTheDocument();
        expect(screen.getByText("Some encryption parameters have been changed.")).toBeInTheDocument();
    });

    it("shows disable attempt copy", () => {
        renderView(EncryptionEventState.DISABLE_ATTEMPT);

        expect(screen.getByText("Encryption enabled")).toBeInTheDocument();
        expect(screen.getByText("Ignored attempt to disable encryption")).toBeInTheDocument();
    });

    it("shows unsupported encryption copy", () => {
        renderView(EncryptionEventState.UNSUPPORTED);

        expect(screen.getByText("Encryption not enabled")).toBeInTheDocument();
        expect(screen.getByText("The encryption used by this room isn't supported.")).toBeInTheDocument();
    });

    it("shows local room encryption copy", () => {
        renderView(EncryptionEventState.ENABLED_LOCAL);

        expect(screen.getByText("Encryption enabled")).toBeInTheDocument();
        expect(screen.getByText("Messages in this chat will be end-to-end encrypted.")).toBeInTheDocument();
    });

    it("shows dm room encryption copy with display name", () => {
        renderView(EncryptionEventState.ENABLED_DM, false, "Alice");

        expect(screen.getByText("Encryption enabled")).toBeInTheDocument();
        expect(
            screen.getByText(
                "Messages here are end-to-end encrypted. Verify Alice in their profile - tap on their profile picture.",
            ),
        ).toBeInTheDocument();
    });

    it("renders additional class name on the event tile bubble", () => {
        renderView(EncryptionEventState.ENABLED, false, undefined, "custom-class");

        expect(screen.getByText("Encryption enabled").parentElement).toHaveClass("custom-class");
    });
});
