/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import EventEmitter from "events";
import { type ISearchResults, type SearchOrderBy } from "matrix-js-sdk/src/matrix";

import { type SearchMatch, type SearchResultPreview, type SearchScope } from "../Searching";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { type ActionPayload } from "../dispatcher/payloads";

export enum SearchSessionStoreEvent {
    Update = "update",
}

/**
 * The immutable identity of a search session — mirrors the start-time fields of a {@link SearchInfo}.
 */
export interface SearchSessionParams {
    searchId: number;
    term: string;
    scope: SearchScope;
    /** The room the search was started from, or undefined for an all-rooms search. */
    roomId?: string;
    /**
     * The active `from:`/sender filter (full MXIDs), or undefined/empty for no sender filter. Part of the
     * session identity: it survives RoomView remounts during cross-room stepping and
     * is preserved verbatim by {@link SearchSessionStore.updateResults}, so a re-search keeps the filter.
     */
    senders?: string[];
    /**
     * The requested result ordering — {@link SearchOrderBy.Recent} (default) or {@link SearchOrderBy.Rank}
     * (relevance). Part of the session identity: it survives RoomView remounts during
     * cross-room stepping and is preserved verbatim by {@link SearchSessionStore.updateResults}, so a re-search
     * keeps the chosen order.
     */
    order?: SearchOrderBy;
    promise: Promise<ISearchResults>;
    abortController?: AbortController;
}

/**
 * The results applied to the live session as the backend settles. `matches`/`highlights` are omitted while the
 * search is still in progress.
 */
export interface SearchSessionResults {
    inProgress: boolean;
    matches?: SearchMatch[];
    /** Result preview rows for the dropdown (parallel to {@link matches}) — see {@link extractSearchResultPreviews}. */
    previews?: SearchResultPreview[];
    highlights?: string[];
    count?: number;
    /** Whether more result pages remain to be paginated in. */
    hasMore?: boolean;
    error?: Error;
}

/**
 * A snapshot of the active search session.
 */
export interface SearchSession extends SearchSessionParams {
    /** Ordered (newest-first), cross-room and unfiltered — see {@link extractSearchMatches}. */
    matches: SearchMatch[];
    /** Result preview rows for the dropdown, parallel to {@link matches} (see {@link extractSearchResultPreviews}). */
    previews: SearchResultPreview[];
    /** Index into {@link matches} of the focused match, or -1 when no match is focused (viewing the results list). */
    currentMatchIndex: number;
    highlights: string[];
    count?: number;
    /** Whether more result pages remain to be paginated into the results dropdown. */
    hasMore?: boolean;
    inProgress: boolean;
    error?: Error;
}

/**
 * Owns the live message-search session independently of any RoomView instance.
 *
 * RoomView is keyed by room id (see LoggedInView), so it unmounts/remounts on any cross-room navigation. Stepping
 * through search matches in the live timeline crosses rooms — an all-rooms search spans rooms, and even a
 * room-scoped search also searches upgraded predecessor rooms (#32258) — so the session (the ordered cross-room
 * match list, the focused index, the highlight terms and the search promise/abort controller) must outlive the
 * component. This singleton is that owner: {@link RoomView} mirrors it into its render state and re-hydrates from it
 * after a remount, while {@link RoomSearchNavigationViewModel} reads/writes the cursor here.
 */
export class SearchSessionStore extends EventEmitter {
    private static _instance: SearchSessionStore | null = null;

    private session: SearchSession | null = null;
    // Transient (not view state, so never emitted): set immediately before a stepping-driven ViewRoom dispatch so
    // RoomView's "edited an event" clear gate can tell a stepping jump apart from a genuine user navigation and not
    // tear the session down. Consumed exactly once; auto-reset whenever fresh results arrive or the session is
    // cleared.
    private steppingJump = false;
    // Durable companion to {@link steppingJump}: the event id the in-flight internal navigation pins the live
    // timeline to — the match we are stepping to, or the event we are clearing on the way back to the results list.
    // The result-click clear gate compares it against the LIVE focused event id rather than consuming the one-shot
    // flag, so it is immune to the race the flag has: any unrelated RoomViewStore emission landing between
    // {@link beginSteppingJump} and our own ViewRoom being processed used to consume the flag early, so the real
    // stepping/return update then saw it already false and the gate wrongly tore the session down (the packaged-build
    // "search resets itself" bug). Persisted — not consumed — and reset ONLY by start()/clear(); deliberately kept
    // across updateResults() and across returns to the results list so a transient un-pinned frame can never unguard
    // the clear gate mid-jump.
    private steppingTargetEventId: string | null = null;
    // Durable marker of the focused match's event id (or null when viewing the results list), set by
    // {@link setCurrentMatchIndex}, reset by start()/clear() and (only) when the focused match drops out of a fresh
    // result set in {@link updateResults}. Unlike {@link SearchSession.currentMatchIndex}
    // — which updateResults invalidates to -1 on every fresh/in-progress result set — this survives a result update,
    // so it is the robust "are we stepping a match, and which one" signal. RoomView derives its stepping render +
    // the result-click clear gate's "results list shown" test from this rather than from the volatile cursor: a
    // settled search update (or a "load more" page) landing while a match is focused used to null the cursor, and a
    // background RoomViewStore emission then treated the focused jump as the results list and clobbered the live
    // flash + in-bubble highlight + centered scroll on the packaged build (the result-click regression).
    private focusedMatchEventId: string | null = null;

    public constructor() {
        super();
        defaultDispatcher.register(this.onAction);
    }

    public static get instance(): SearchSessionStore {
        if (!SearchSessionStore._instance) {
            SearchSessionStore._instance = new SearchSessionStore();
        }
        return SearchSessionStore._instance;
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.OnLoggedOut) {
            this.clear({ abort: true });
        }
    };

    /**
     * Begin a new search session, replacing and aborting any previous one. Matches/highlights stay empty until
     * {@link updateResults} is called once the backend settles.
     */
    public start(params: SearchSessionParams): void {
        // A new term replaces the previous session; abort its in-flight request so we never adopt stale results.
        this.session?.abortController?.abort();
        this.session = {
            ...params,
            matches: [],
            previews: [],
            currentMatchIndex: -1,
            highlights: [],
            hasMore: false,
            inProgress: true,
        };
        this.steppingJump = false;
        this.steppingTargetEventId = null;
        this.focusedMatchEventId = null;
        this.emit(SearchSessionStoreEvent.Update);
    }

    /**
     * Apply settled (or in-progress) results to the live session. No-op if there is no active session.
     */
    public updateResults(results: SearchSessionResults): void {
        if (!this.session) return;
        const matches = results.matches ?? this.session.matches;
        // A fresh result set invalidates the index-based cursor, BUT if a match is still focused (durable
        // {@link focusedMatchEventId}, e.g. a settled search/"load more" landed mid-step) re-derive the cursor onto
        // that same match by event id so stepping and the "k of N" counter stay put — instead of snapping back to
        // "no match" (-1) and collapsing the live highlight. No focus → -1 (viewing the list).
        const refocusedIndex = this.focusedMatchEventId
            ? matches.findIndex((m) => m.eventId === this.focusedMatchEventId)
            : -1;
        // If the focused match dropped out of the new result set entirely, stop treating it as focused too, so the
        // UI falls back to the results list coherently instead of stranding on a hidden live timeline with a
        // "0 of N" counter and no back-to-results affordance.
        if (refocusedIndex < 0) {
            this.focusedMatchEventId = null;
        }
        this.session = {
            ...this.session,
            inProgress: results.inProgress,
            matches,
            previews: results.previews ?? this.session.previews,
            highlights: results.highlights ?? this.session.highlights,
            count: results.count,
            hasMore: results.hasMore ?? this.session.hasMore,
            error: results.error,
            currentMatchIndex: refocusedIndex,
        };
        // Fresh results end any in-flight one-shot stepping jump. NB: deliberately do NOT clear steppingTargetEventId
        // here — returning from stepping to the results list re-mounts RoomView's hidden RoomSearchView data engine,
        // which re-resolves the (already-settled) promise and calls updateResults again; clearing the durable target
        // here would unguard the clear gate for exactly that return-to-list window and let an unrelated emission tear
        // the session down (the "search resets itself" bug). The target is reset only by start()/clear().
        this.steppingJump = false;
        this.emit(SearchSessionStoreEvent.Update);
    }

    /**
     * Move the focused-match cursor. `-1` means "no match focused" (viewing the results list).
     */
    public setCurrentMatchIndex(index: number): void {
        // Record the durable focused-match marker BEFORE the no-op guard below, so returning to the list
        // (setCurrentMatchIndex(-1)) always clears it even when the cursor was already -1 (e.g. a prior
        // updateResults left it there). A focused index maps to that match's event id; -1 clears the focus.
        this.focusedMatchEventId = index >= 0 ? (this.session?.matches[index]?.eventId ?? null) : null;
        if (!this.session || this.session.currentMatchIndex === index) return;
        this.session = { ...this.session, currentMatchIndex: index };
        this.emit(SearchSessionStoreEvent.Update);
    }

    /**
     * Mark that the next ViewRoom dispatch is an internal search navigation (stepping to a match, or clearing the
     * focused event on return to the results list), not a user navigating away. `eventId` is the event the live
     * timeline is/was pinned to for this navigation — a match's event id when stepping, or the event being cleared
     * when returning to the list. The result-click clear gate treats a focused event equal to it as ours (durable —
     * {@link steppingTarget}), so it never tears the session down even if an unrelated emission consumed the one-shot
     * {@link steppingJump} flag first.
     */
    public beginSteppingJump(eventId: string | null): void {
        this.steppingJump = true;
        this.steppingTargetEventId = eventId;
    }

    /** Read and reset the one-shot stepping-jump flag. Used by the edit clear gate (exactly-once). */
    public consumeSteppingJump(): boolean {
        const value = this.steppingJump;
        this.steppingJump = false;
        return value;
    }

    /** Read the one-shot stepping-jump flag without resetting it. Used by the edit clear gate. */
    public isSteppingJump(): boolean {
        return this.steppingJump;
    }

    /**
     * The event id the in-flight internal navigation pins the live timeline to, or null if none. The result-click
     * clear gate leaves the session alive while the focused event equals this — robust against the one-shot
     * {@link steppingJump} flag being consumed early by an unrelated RoomViewStore emission.
     */
    public get steppingTarget(): string | null {
        return this.steppingTargetEventId;
    }

    /**
     * The focused match's event id, or null when viewing the results list. Durable: survives {@link updateResults}
     * (reset only by start()/clear()), so it is the race-free "stepping a match?" signal RoomView renders from —
     * see {@link focusedMatchEventId}.
     */
    public get focusedMatch(): string | null {
        return this.focusedMatchEventId;
    }

    /**
     * End the session. Aborts the in-flight request unless `abort` is false (the session is never cleared on a
     * remount, so the surviving promise is never rejected by a room switch).
     */
    public clear({ abort = true }: { abort?: boolean } = {}): void {
        if (abort) {
            this.session?.abortController?.abort();
        }
        this.session = null;
        this.steppingJump = false;
        this.steppingTargetEventId = null;
        this.focusedMatchEventId = null;
        this.emit(SearchSessionStoreEvent.Update);
    }

    public hasActiveSession(): boolean {
        return this.session !== null;
    }

    public getSnapshot(): SearchSession | null {
        return this.session;
    }

    public get matches(): SearchMatch[] {
        return this.session?.matches ?? [];
    }

    public get currentMatchIndex(): number {
        return this.session?.currentMatchIndex ?? -1;
    }
}
