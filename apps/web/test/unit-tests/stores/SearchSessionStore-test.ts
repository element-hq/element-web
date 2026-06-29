/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ISearchResults, SearchOrderBy } from "matrix-js-sdk/src/matrix";

import { SearchSessionStore, SearchSessionStoreEvent } from "../../../src/stores/SearchSessionStore";
import { type SearchMatch, SearchScope } from "../../../src/Searching";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";

const match = (roomId: string, eventId: string): SearchMatch => ({ roomId, eventId });

describe("SearchSessionStore", () => {
    let store: SearchSessionStore;
    const promise = Promise.resolve({ results: [], highlights: [], count: 0 } as unknown as ISearchResults);

    const start = (overrides: Partial<Parameters<SearchSessionStore["start"]>[0]> = {}): AbortController => {
        const abortController = new AbortController();
        store.start({
            searchId: 1,
            term: "hello",
            scope: SearchScope.Room,
            roomId: "!a:server",
            promise,
            abortController,
            ...overrides,
        });
        return abortController;
    };

    beforeEach(() => {
        store = SearchSessionStore.instance;
        // Start each test from a clean singleton (the store survives the whole file, like UIStore).
        store.clear({ abort: false });
    });

    afterEach(() => {
        store.clear({ abort: false });
    });

    describe("start", () => {
        it("creates an active session with an empty cursor and matches", () => {
            start();
            expect(store.hasActiveSession()).toBe(true);
            const snapshot = store.getSnapshot();
            expect(snapshot).toMatchObject({
                searchId: 1,
                term: "hello",
                scope: SearchScope.Room,
                roomId: "!a:server",
                matches: [],
                highlights: [],
                currentMatchIndex: -1,
                inProgress: true,
            });
            expect(store.matches).toEqual([]);
            expect(store.currentMatchIndex).toBe(-1);
        });

        it("emits Update when a session starts", () => {
            const listener = jest.fn();
            store.on(SearchSessionStoreEvent.Update, listener);
            start();
            expect(listener).toHaveBeenCalledTimes(1);
            store.off(SearchSessionStoreEvent.Update, listener);
        });

        it("replaces and aborts the previous session when a new term starts", () => {
            const first = start({ searchId: 1, term: "first" });
            const second = start({ searchId: 2, term: "second" });
            expect(first.signal.aborted).toBe(true);
            expect(second.signal.aborted).toBe(false);
            expect(store.getSnapshot()?.term).toBe("second");
        });
    });

    describe("updateResults", () => {
        it("applies cross-room matches/highlights/count and resets the cursor", () => {
            start();
            const matches = [match("!a:server", "$1"), match("!predecessor:server", "$2")];
            store.setCurrentMatchIndex(1);
            store.updateResults({ inProgress: false, matches, highlights: ["hello"], count: 7 });
            const snapshot = store.getSnapshot();
            expect(snapshot?.matches).toEqual(matches);
            expect(snapshot?.highlights).toEqual(["hello"]);
            expect(snapshot?.count).toBe(7);
            expect(snapshot?.inProgress).toBe(false);
            // A fresh result set invalidates the cursor.
            expect(snapshot?.currentMatchIndex).toBe(-1);
        });

        it("is a no-op when there is no active session", () => {
            const listener = jest.fn();
            store.on(SearchSessionStoreEvent.Update, listener);
            store.updateResults({ inProgress: false, matches: [match("!a:server", "$1")] });
            expect(store.hasActiveSession()).toBe(false);
            expect(listener).not.toHaveBeenCalled();
            store.off(SearchSessionStoreEvent.Update, listener);
        });

        it("records an error", () => {
            start();
            const error = new Error("boom");
            store.updateResults({ inProgress: false, error });
            expect(store.getSnapshot()?.error).toBe(error);
        });

        it("preserves the senders (from:) filter across result updates", () => {
            start({ senders: ["@alice:server"] });
            expect(store.getSnapshot()?.senders).toEqual(["@alice:server"]);
            store.updateResults({ inProgress: false, matches: [match("!a:server", "$1")], count: 1 });
            // The sender filter is session identity, not per-result state: it must survive updateResults.
            expect(store.getSnapshot()?.senders).toEqual(["@alice:server"]);
        });

        it("preserves the result order (recent/relevant) across result updates", () => {
            start({ order: SearchOrderBy.Rank });
            expect(store.getSnapshot()?.order).toBe(SearchOrderBy.Rank);
            store.updateResults({ inProgress: false, matches: [match("!a:server", "$1")], count: 1 });
            // The chosen order is session identity, not per-result state: it must survive updateResults.
            expect(store.getSnapshot()?.order).toBe(SearchOrderBy.Rank);
        });
    });

    describe("setCurrentMatchIndex", () => {
        it("moves the cursor and emits Update", () => {
            start();
            store.updateResults({ inProgress: false, matches: [match("!a:server", "$1"), match("!b:server", "$2")] });
            const listener = jest.fn();
            store.on(SearchSessionStoreEvent.Update, listener);
            store.setCurrentMatchIndex(1);
            expect(store.currentMatchIndex).toBe(1);
            expect(listener).toHaveBeenCalledTimes(1);
            store.off(SearchSessionStoreEvent.Update, listener);
        });

        it("accepts -1 to clear the focus (back to the list)", () => {
            start();
            store.setCurrentMatchIndex(0);
            store.setCurrentMatchIndex(-1);
            expect(store.currentMatchIndex).toBe(-1);
        });

        it("is a no-op when there is no active session", () => {
            store.setCurrentMatchIndex(2);
            expect(store.currentMatchIndex).toBe(-1);
        });
    });

    describe("clear", () => {
        it("aborts the in-flight request by default and drops the session", () => {
            const abortController = start();
            store.clear();
            expect(abortController.signal.aborted).toBe(true);
            expect(store.hasActiveSession()).toBe(false);
            expect(store.getSnapshot()).toBeNull();
        });

        it("does not abort when abort:false", () => {
            const abortController = start();
            store.clear({ abort: false });
            expect(abortController.signal.aborted).toBe(false);
            expect(store.hasActiveSession()).toBe(false);
        });
    });

    describe("steppingJump flag", () => {
        it("defaults to false", () => {
            start();
            expect(store.isSteppingJump()).toBe(false);
        });

        it("begin sets it; isSteppingJump reads it non-destructively", () => {
            start();
            store.beginSteppingJump("$e");
            expect(store.isSteppingJump()).toBe(true);
            expect(store.isSteppingJump()).toBe(true);
        });

        it("consume returns true once then false", () => {
            start();
            store.beginSteppingJump("$e");
            expect(store.consumeSteppingJump()).toBe(true);
            expect(store.consumeSteppingJump()).toBe(false);
        });

        it("does not emit Update when toggled (it is not view state)", () => {
            start();
            const listener = jest.fn();
            store.on(SearchSessionStoreEvent.Update, listener);
            store.beginSteppingJump("$e");
            store.consumeSteppingJump();
            expect(listener).not.toHaveBeenCalled();
            store.off(SearchSessionStoreEvent.Update, listener);
        });

        it("auto-resets when fresh results arrive", () => {
            start();
            store.beginSteppingJump("$e");
            store.updateResults({ inProgress: false, matches: [] });
            expect(store.isSteppingJump()).toBe(false);
        });

        it("is cleared when the session is cleared", () => {
            start();
            store.beginSteppingJump("$e");
            store.clear();
            expect(store.isSteppingJump()).toBe(false);
        });
    });

    describe("steppingTarget (durable navigation guard)", () => {
        it("defaults to null", () => {
            start();
            expect(store.steppingTarget).toBeNull();
        });

        it("begin records the event id and survives the one-shot flag being consumed", () => {
            start();
            store.beginSteppingJump("$hit");
            expect(store.steppingTarget).toBe("$hit");
            // Consuming the flag (an unrelated update would) must NOT clear the durable target — that is the whole
            // point: the result-click clear gate still recognises our own navigation after the flag is gone.
            store.consumeSteppingJump();
            expect(store.steppingTarget).toBe("$hit");
        });

        it("persists across fresh results (so the return-to-results re-render does not unguard the clear gate)", () => {
            start();
            store.beginSteppingJump("$hit");
            // Returning from stepping re-mounts the hidden RoomSearchView, which re-resolves the promise and calls
            // updateResults again — the durable target must survive that so the clear gate stays guarded for the
            // return-to-list window. (The one-shot flag still resets here.)
            store.updateResults({ inProgress: false, matches: [] });
            expect(store.steppingTarget).toBe("$hit");
            expect(store.isSteppingJump()).toBe(false);
        });

        it("resets to null on a new search session (start)", () => {
            start();
            store.beginSteppingJump("$hit");
            start();
            expect(store.steppingTarget).toBeNull();
        });

        it("resets to null when the session is cleared", () => {
            start();
            store.beginSteppingJump("$hit");
            store.clear();
            expect(store.steppingTarget).toBeNull();
        });
    });

    describe("focusedMatch (durable stepping marker)", () => {
        const matches = [match("!a:server", "$1"), match("!b:server", "$2"), match("!c:server", "$3")];

        it("defaults to null", () => {
            start();
            expect(store.focusedMatch).toBeNull();
        });

        it("tracks the focused match's event id when the cursor moves to it", () => {
            start();
            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(1);
            expect(store.focusedMatch).toBe("$2");
        });

        it("clears to null when the cursor returns to the results list (-1)", () => {
            start();
            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(1);
            store.setCurrentMatchIndex(-1);
            expect(store.focusedMatch).toBeNull();
        });

        it("survives a fresh result set so a settled search update mid-step cannot collapse stepping", () => {
            start();
            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(1);
            // The async search settles again / a "load more" page lands WHILE a match is focused. Unlike the
            // volatile cursor (which updateResults resets), the durable focus must survive — otherwise a background
            // RoomViewStore emission makes RoomView treat the focused jump as "results list shown" and clobbers the
            // live flash + in-bubble highlight + centered scroll (the packaged-build result-click regression).
            store.updateResults({ inProgress: false, matches });
            expect(store.focusedMatch).toBe("$2");
            // The cursor is re-derived back onto the focused match (not reset to -1), so the "k of N" counter stays.
            expect(store.currentMatchIndex).toBe(1);
        });

        it("re-derives the cursor onto the focused match when its index shifts in new results", () => {
            start();
            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(2); // focus $3
            // A new result set where $3 is now at index 0.
            store.updateResults({
                inProgress: false,
                matches: [match("!c:server", "$3"), match("!a:server", "$1")],
            });
            expect(store.focusedMatch).toBe("$3");
            expect(store.currentMatchIndex).toBe(0);
        });

        it("clears the focus when the focused match drops out of a fresh result set", () => {
            start();
            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(1); // focus $2
            // A new result set that no longer contains $2 — the focus must drop so the UI falls back to the list
            // coherently (not strand on a hidden timeline with a "0 of N" counter).
            store.updateResults({ inProgress: false, matches: [match("!a:server", "$1")] });
            expect(store.focusedMatch).toBeNull();
            expect(store.currentMatchIndex).toBe(-1);
        });

        it("resets to null on a new search (start) and on clear", () => {
            start();
            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(1);
            start();
            expect(store.focusedMatch).toBeNull();

            store.updateResults({ inProgress: false, matches });
            store.setCurrentMatchIndex(1);
            store.clear();
            expect(store.focusedMatch).toBeNull();
        });
    });

    describe("logout reset", () => {
        it("clears the session and aborts on Action.OnLoggedOut", () => {
            const abortController = start();
            defaultDispatcher.dispatch({ action: Action.OnLoggedOut }, true);
            expect(store.hasActiveSession()).toBe(false);
            expect(abortController.signal.aborted).toBe(true);
        });
    });
});
