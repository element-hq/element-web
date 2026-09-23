/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "test-utils-rtl";

import RoomSearchAuxPanel from "./RoomSearchAuxPanel";
import { SearchScope } from "../../../Searching";

describe("RoomSearchAuxPanel", () => {
    it("should render the count of results", () => {
        render(
            <RoomSearchAuxPanel
                searchInfo={{
                    searchId: 1234,
                    count: 5,
                    term: "abcd",
                    scope: SearchScope.Room,
                    promise: new Promise(() => {}),
                }}
                isRoomEncrypted={false}
                onSearchScopeChange={vi.fn()}
                onCancelClick={vi.fn()}
            />,
        );

        expect(screen.getByText("5 results found for", { exact: false })).toHaveTextContent(
            "5 results found for “abcd”",
        );
    });

    it("should allow the user to toggle to all rooms search", async () => {
        const onSearchScopeChange = vi.fn();

        render(
            <RoomSearchAuxPanel
                isRoomEncrypted={false}
                onSearchScopeChange={onSearchScopeChange}
                onCancelClick={vi.fn()}
            />,
        );

        screen.getByText("Search all rooms").click();
        expect(onSearchScopeChange).toHaveBeenCalledWith(SearchScope.All);
    });

    it("should allow the user to toggle back to room-specific search", async () => {
        const onSearchScopeChange = vi.fn();

        render(
            <RoomSearchAuxPanel
                searchInfo={{
                    searchId: 1234,
                    term: "abcd",
                    scope: SearchScope.All,
                    promise: new Promise(() => {}),
                }}
                isRoomEncrypted={false}
                onSearchScopeChange={onSearchScopeChange}
                onCancelClick={vi.fn()}
            />,
        );

        screen.getByText("Search this room").click();
        expect(onSearchScopeChange).toHaveBeenCalledWith(SearchScope.Room);
    });

    it("should allow the user to cancel a search", async () => {
        const onCancelClick = vi.fn();

        render(
            <RoomSearchAuxPanel isRoomEncrypted={false} onSearchScopeChange={vi.fn()} onCancelClick={onCancelClick} />,
        );

        screen.getByRole("button", { name: "Cancel" }).click();
        expect(onCancelClick).toHaveBeenCalled();
    });
});
