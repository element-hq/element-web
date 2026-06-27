/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { Room, type RoomMember, SearchOrderBy } from "matrix-js-sdk/src/matrix";

import RoomSearchHeader from "../../../../../src/components/views/rooms/RoomSearchHeader";
import { type SearchMatch, SearchScope } from "../../../../../src/Searching";
import { RoomSearchNavigationViewModel } from "../../../../../src/viewmodels/search/RoomSearchNavigationViewModel";
import { SearchSessionStore } from "../../../../../src/stores/SearchSessionStore";
import { Action } from "../../../../../src/dispatcher/actions";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { stubClient } from "../../../../test-utils";

const member = (userId: string, name: string): RoomMember => ({ userId, name }) as RoomMember;

describe("RoomSearchHeader", () => {
    const vms: RoomSearchNavigationViewModel[] = [];

    const buildRoom = (members: RoomMember[] = [member("@me:server", "Me")]): Room => {
        const client = mocked(stubClient());
        const room = new Room("!r:server", client, "@me:server");
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(members);
        return room;
    };

    const seedMatches = (matches: SearchMatch[]): void => {
        const store = SearchSessionStore.instance;
        store.start({
            searchId: 1,
            term: "abcd",
            scope: SearchScope.Room,
            promise: new Promise(() => {}),
            abortController: new AbortController(),
        });
        store.updateResults({ inProgress: false, matches });
    };

    const makeVm = (): RoomSearchNavigationViewModel => {
        const vm = new RoomSearchNavigationViewModel({ onActivateMatch: jest.fn() });
        vms.push(vm);
        return vm;
    };

    const renderHeader = (props: Partial<React.ComponentProps<typeof RoomSearchHeader>> = {}): void => {
        render(
            <RoomSearchHeader
                room={buildRoom()}
                term=""
                onSearchChange={jest.fn()}
                onCancel={jest.fn()}
                isRoomEncrypted={false}
                scope={SearchScope.Room}
                onSearchScopeChange={jest.fn()}
                senders={[]}
                onSearchSendersChange={jest.fn()}
                order={SearchOrderBy.Recent}
                onSearchOrderChange={jest.fn()}
                {...props}
            />,
        );
    };

    beforeEach(() => {
        SearchSessionStore.instance.clear({ abort: false });
    });

    afterEach(() => {
        while (vms.length) vms.pop()!.dispose();
        SearchSessionStore.instance.clear({ abort: false });
        jest.restoreAllMocks();
    });

    it("does not run a search while typing, only committing it on Enter", async () => {
        const onSearchChange = jest.fn();
        renderHeader({ onSearchChange, autoFocus: true });

        const input = screen.getByPlaceholderText("Search messages…");
        expect(input).toHaveFocus();

        await userEvent.type(input, "gemini");
        // Typing must not trigger a search (search waits for Enter).
        expect(onSearchChange).not.toHaveBeenCalled();

        await userEvent.keyboard("{Enter}");
        expect(onSearchChange).toHaveBeenCalledTimes(1);
        expect(onSearchChange).toHaveBeenCalledWith("gemini");
    });

    it("does nothing on Enter when the input is empty", async () => {
        const onSearchChange = jest.fn();
        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
        renderHeader({ onSearchChange, autoFocus: true });

        await userEvent.keyboard("{Enter}");
        expect(onSearchChange).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ action: Action.SearchMatchStep }));
    });

    it("cancels the search when the cancel button is clicked", async () => {
        const onCancel = jest.fn();
        renderHeader({ onCancel });

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalled();
    });

    it("cancels the search when Escape is pressed in the input", async () => {
        const onCancel = jest.fn();
        renderHeader({ onCancel, autoFocus: true });

        await userEvent.keyboard("{Escape}");
        expect(onCancel).toHaveBeenCalled();
    });

    it("steps matches on Enter/Shift+Enter once the typed term is already searched", async () => {
        const onSearchChange = jest.fn();
        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
        // term="abcd" means the box value (synced from term) matches what was already searched, so Enter steps.
        renderHeader({ term: "abcd", onSearchChange, autoFocus: true });

        await userEvent.keyboard("{Enter}");
        expect(onSearchChange).not.toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ action: Action.SearchMatchStep, direction: "next" }),
        );

        dispatchSpy.mockClear();
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ action: Action.SearchMatchStep, direction: "previous" }),
        );
    });

    it("steps (not re-searches) when only surrounding whitespace differs from the searched term", async () => {
        const onSearchChange = jest.fn();
        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
        renderHeader({ term: "abcd", onSearchChange, autoFocus: true });

        // Box now holds "abcd " (a trailing space). Trimmed it equals the searched term, so Enter must step, not
        // fire a redundant search.
        await userEvent.type(screen.getByPlaceholderText("Search messages…"), " ");
        await userEvent.keyboard("{Enter}");

        expect(onSearchChange).not.toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ action: Action.SearchMatchStep, direction: "next" }),
        );
    });

    it("commits the trimmed term when searching on Enter", async () => {
        const onSearchChange = jest.fn();
        renderHeader({ onSearchChange, autoFocus: true });

        await userEvent.type(screen.getByPlaceholderText("Search messages…"), "  gemini  ");
        await userEvent.keyboard("{Enter}");
        expect(onSearchChange).toHaveBeenCalledWith("gemini");
    });

    it("shows the results-count summary", () => {
        renderHeader({
            searchInfo: {
                searchId: 1234,
                count: 5,
                term: "abcd",
                scope: SearchScope.Room,
                promise: new Promise(() => {}),
            },
        });

        expect(screen.getByText("5 results found for", { exact: false })).toBeInTheDocument();
    });

    it("renders the match stepper when the navigation view model has matches", () => {
        const navigationVm = makeVm();
        seedMatches([
            { roomId: "!r:e", eventId: "$a" },
            { roomId: "!r:e", eventId: "$b" },
        ]);

        renderHeader({
            navigationVm,
            searchInfo: {
                searchId: 1234,
                count: 2,
                term: "abcd",
                scope: SearchScope.Room,
                promise: new Promise(() => {}),
            },
        });

        expect(screen.getByText("0 of 2", { exact: false })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next match" })).toBeInTheDocument();
    });

    it("toggles the search scope to all rooms", async () => {
        const onSearchScopeChange = jest.fn();
        renderHeader({ onSearchScopeChange });

        await userEvent.click(screen.getByText("Search all rooms"));
        expect(onSearchScopeChange).toHaveBeenCalledWith(SearchScope.All);
    });

    it("mounts the order toggle and the sender filter controls", () => {
        renderHeader({ room: buildRoom([member("@me:server", "Me"), member("@alice:server", "Alice")]) });

        expect(screen.getByTestId("search-order-toggle-button")).toBeInTheDocument();
        expect(screen.getByTestId("search-sender-filter-button")).toBeInTheDocument();
    });

    it("returns to the results list when the search box is clicked while a match is focused", async () => {
        const onBackToResults = jest.fn();
        renderHeader({
            onBackToResults,
            // currentMatchIndex >= 0 means a match is focused in the live timeline (stepping), so the dropdown is
            // hidden. Clicking the search box is the user's intuitive way to bring the results list back.
            searchInfo: {
                searchId: 1234,
                count: 3,
                term: "abcd",
                scope: SearchScope.Room,
                promise: new Promise(() => {}),
                currentMatchIndex: 0,
            },
        });

        await userEvent.click(screen.getByPlaceholderText("Search messages…"));
        expect(onBackToResults).toHaveBeenCalledTimes(1);
    });

    it("does not return to the results list when the search box is clicked while not stepping", async () => {
        const onBackToResults = jest.fn();
        renderHeader({
            onBackToResults,
            // No focused match (results list already visible) — clicking the box is a plain focus, not a return.
            searchInfo: {
                searchId: 1234,
                count: 3,
                term: "abcd",
                scope: SearchScope.Room,
                promise: new Promise(() => {}),
            },
        });

        await userEvent.click(screen.getByPlaceholderText("Search messages…"));
        expect(onBackToResults).not.toHaveBeenCalled();
    });
});
