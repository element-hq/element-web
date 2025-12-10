/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React from "react";
import userEvent from "@testing-library/user-event";

import { RoomListSearch, type RoomListSearchProps } from "./RoomListSearch";

describe("RoomListSearch", () => {
    it("renders search button with shortcut", () => {
        const onSearchClick = jest.fn();
        const props: RoomListSearchProps = {
            onSearchClick,
            showDialPad: false,
            showExplore: false,
        };

        render(<RoomListSearch {...props} />);

        expect(screen.getByRole("search")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
        // Keyboard shortcut should be visible
        expect(screen.getByText(/K/)).toBeInTheDocument();
    });

    it("calls onSearchClick when search button is clicked", async () => {
        const onSearchClick = jest.fn();
        const props: RoomListSearchProps = {
            onSearchClick,
            showDialPad: false,
            showExplore: false,
        };

        render(<RoomListSearch {...props} />);

        await userEvent.click(screen.getByRole("button", { name: /search/i }));
        expect(onSearchClick).toHaveBeenCalledTimes(1);
    });

    it("renders dial pad button when showDialPad is true", () => {
        const onDialPadClick = jest.fn();
        const props: RoomListSearchProps = {
            onSearchClick: jest.fn(),
            showDialPad: true,
            onDialPadClick,
            showExplore: false,
        };

        render(<RoomListSearch {...props} />);

        expect(screen.getByRole("button", { name: /dial pad/i })).toBeInTheDocument();
    });

    it("calls onDialPadClick when dial pad button is clicked", async () => {
        const onDialPadClick = jest.fn();
        const props: RoomListSearchProps = {
            onSearchClick: jest.fn(),
            showDialPad: true,
            onDialPadClick,
            showExplore: false,
        };

        render(<RoomListSearch {...props} />);

        await userEvent.click(screen.getByRole("button", { name: /dial pad/i }));
        expect(onDialPadClick).toHaveBeenCalledTimes(1);
    });

    it("renders explore button when showExplore is true", () => {
        const onExploreClick = jest.fn();
        const props: RoomListSearchProps = {
            onSearchClick: jest.fn(),
            showDialPad: false,
            showExplore: true,
            onExploreClick,
        };

        render(<RoomListSearch {...props} />);

        expect(screen.getByRole("button", { name: /explore/i })).toBeInTheDocument();
    });

    it("calls onExploreClick when explore button is clicked", async () => {
        const onExploreClick = jest.fn();
        const props: RoomListSearchProps = {
            onSearchClick: jest.fn(),
            showDialPad: false,
            showExplore: true,
            onExploreClick,
        };

        render(<RoomListSearch {...props} />);

        await userEvent.click(screen.getByRole("button", { name: /explore/i }));
        expect(onExploreClick).toHaveBeenCalledTimes(1);
    });

    it("renders all buttons when showDialPad and showExplore are true", () => {
        const props: RoomListSearchProps = {
            onSearchClick: jest.fn(),
            showDialPad: true,
            onDialPadClick: jest.fn(),
            showExplore: true,
            onExploreClick: jest.fn(),
        };

        render(<RoomListSearch {...props} />);

        expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /dial pad/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /explore/i })).toBeInTheDocument();
    });

    it("does not render dial pad or explore buttons when flags are false", () => {
        const props: RoomListSearchProps = {
            onSearchClick: jest.fn(),
            showDialPad: false,
            showExplore: false,
        };

        render(<RoomListSearch {...props} />);

        expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /dial pad/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /explore/i })).not.toBeInTheDocument();
    });
});
