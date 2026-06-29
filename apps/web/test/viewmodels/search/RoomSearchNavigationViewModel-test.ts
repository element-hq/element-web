/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ISearchResults } from "matrix-js-sdk/src/matrix";

import {
    RoomSearchNavigationViewModel,
    type RoomSearchNavigationProps,
} from "../../../src/viewmodels/search/RoomSearchNavigationViewModel";
import { type SearchMatch, SearchScope } from "../../../src/Searching";
import { SearchSessionStore } from "../../../src/stores/SearchSessionStore";

describe("RoomSearchNavigationViewModel", () => {
    const matchA: SearchMatch = { roomId: "!r:e", eventId: "$a" };
    const matchB: SearchMatch = { roomId: "!r:e", eventId: "$b" };
    const matchC: SearchMatch = { roomId: "!r:e", eventId: "$c" };
    const promise = Promise.resolve({ results: [], highlights: [], count: 0 } as unknown as ISearchResults);

    let store: SearchSessionStore;
    let vms: RoomSearchNavigationViewModel[];

    const setMatches = (matches: SearchMatch[]): void => {
        store.start({
            searchId: 1,
            term: "x",
            scope: SearchScope.Room,
            promise,
            abortController: new AbortController(),
        });
        store.updateResults({ inProgress: false, matches });
    };

    const makeVm = (props: RoomSearchNavigationProps): RoomSearchNavigationViewModel => {
        const vm = new RoomSearchNavigationViewModel(props);
        vms.push(vm);
        return vm;
    };

    beforeEach(() => {
        store = SearchSessionStore.instance;
        store.clear({ abort: false });
        vms = [];
    });

    afterEach(() => {
        vms.forEach((vm) => {
            if (!vm.isDisposed) vm.dispose();
        });
        store.clear({ abort: false });
    });

    it("starts empty with both arrows disabled", () => {
        const vm = makeVm({ onActivateMatch: jest.fn() });
        expect(vm.getSnapshot()).toEqual({ current: 0, total: 0, canPrevious: false, canNext: false });
    });

    it("reflects the store's total and enables both arrows once matches are set", () => {
        const vm = makeVm({ onActivateMatch: jest.fn() });
        setMatches([matchA, matchB, matchC]);
        expect(vm.getSnapshot()).toEqual({ current: 0, total: 3, canPrevious: true, canNext: true });
    });

    it("hydrates its snapshot from an already-populated store on construction", () => {
        setMatches([matchA, matchB, matchC]);
        store.setCurrentMatchIndex(1);
        const vm = makeVm({ onActivateMatch: jest.fn() });
        expect(vm.getSnapshot()).toEqual({ current: 2, total: 3, canPrevious: true, canNext: true });
    });

    it("activates the first match on next() from the empty cursor and marks a stepping jump", () => {
        const onActivateMatch = jest.fn();
        const vm = makeVm({ onActivateMatch });
        setMatches([matchA, matchB, matchC]);
        vm.next();
        expect(onActivateMatch).toHaveBeenCalledWith(matchA, 0);
        expect(store.currentMatchIndex).toBe(0);
        expect(store.isSteppingJump()).toBe(true);
        expect(vm.getSnapshot()).toEqual({ current: 1, total: 3, canPrevious: true, canNext: true });
    });

    it("steps forward through every match", () => {
        const onActivateMatch = jest.fn();
        const vm = makeVm({ onActivateMatch });
        setMatches([matchA, matchB, matchC]);
        vm.next();
        vm.next();
        vm.next();
        expect(onActivateMatch).toHaveBeenNthCalledWith(3, matchC, 2);
        expect(vm.getSnapshot()).toEqual({ current: 3, total: 3, canPrevious: true, canNext: true });
    });

    it("wraps from the last match back to the first on next()", () => {
        const onActivateMatch = jest.fn();
        const vm = makeVm({ onActivateMatch });
        setMatches([matchA, matchB, matchC]);
        vm.next();
        vm.next();
        vm.next();
        onActivateMatch.mockClear();
        vm.next();
        expect(onActivateMatch).toHaveBeenCalledWith(matchA, 0);
        expect(vm.getSnapshot()).toEqual({ current: 1, total: 3, canPrevious: true, canNext: true });
    });

    it("wraps to the last match on previous() from the empty cursor", () => {
        const onActivateMatch = jest.fn();
        const vm = makeVm({ onActivateMatch });
        setMatches([matchA, matchB]);
        vm.previous();
        expect(onActivateMatch).toHaveBeenCalledWith(matchB, 1);
        expect(vm.getSnapshot()).toEqual({ current: 2, total: 2, canPrevious: true, canNext: true });
    });

    it("wraps from the first match to the last on previous()", () => {
        const onActivateMatch = jest.fn();
        const vm = makeVm({ onActivateMatch });
        setMatches([matchA, matchB, matchC]);
        vm.next();
        onActivateMatch.mockClear();
        vm.previous();
        expect(onActivateMatch).toHaveBeenCalledWith(matchC, 2);
        expect(vm.getSnapshot()).toEqual({ current: 3, total: 3, canPrevious: true, canNext: true });
    });

    it("resets the cursor when the store gets a fresh result set", () => {
        const vm = makeVm({ onActivateMatch: jest.fn() });
        setMatches([matchA, matchB, matchC]);
        vm.next();
        vm.next();
        setMatches([matchA]);
        expect(vm.getSnapshot()).toEqual({ current: 0, total: 1, canPrevious: true, canNext: true });
    });

    it("does nothing when stepping with no matches", () => {
        const onActivateMatch = jest.fn();
        const vm = makeVm({ onActivateMatch });
        vm.next();
        vm.previous();
        expect(onActivateMatch).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toEqual({ current: 0, total: 0, canPrevious: false, canNext: false });
    });

    it("reacts to an external store cursor change", () => {
        const vm = makeVm({ onActivateMatch: jest.fn() });
        setMatches([matchA, matchB, matchC]);
        store.setCurrentMatchIndex(2);
        expect(vm.getSnapshot()).toEqual({ current: 3, total: 3, canPrevious: true, canNext: true });
    });

    it("stops reacting to the store once disposed", () => {
        const vm = makeVm({ onActivateMatch: jest.fn() });
        setMatches([matchA, matchB]);
        vm.dispose();
        store.setCurrentMatchIndex(1);
        expect(vm.getSnapshot()).toEqual({ current: 0, total: 2, canPrevious: true, canNext: true });
    });
});
