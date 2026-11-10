/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import {
    RoomEvent,
    TypedEventEmitter,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk/src/matrix";
import { mkMessage, stubClient } from "test-utils";
import type { AgentResult } from "shared-types";

import { ReplySuggestionsViewModel, SUGGESTION_DELAY_MS } from "./ReplySuggestionsViewModel";
import type { AgentApi } from "../../agent/AgentApi";
import { AgentRoomStore } from "../../agent/AgentRoomStore";
import DMRoomMap from "../../utils/DMRoomMap";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { TimelineRenderingType } from "../../contexts/RoomContext";

const PARTNER = "@bob:example.org";
const LIVE = { liveEvent: true } as IRoomTimelineData;
const SUGGESTIONS = ["Sure!", "Not today", "Let me check"];

/** Each test gets a room of its own, as the suggestions are kept per room across view models */
let roomCount = 0;

describe("ReplySuggestionsViewModel", () => {
    let client: MatrixClient;
    let agent: Mocked<AgentApi>;
    let room: Room;
    let roomId: string;
    let events: MatrixEvent[];
    let me: string;
    let vm: ReplySuggestionsViewModel | undefined;

    function message(sender: string, body: string): MatrixEvent {
        return mkMessage({ room: roomId, user: sender, msg: body, ts: Date.now(), event: true });
    }

    /** A message appended to the timeline and announced as a live event */
    function receive(sender: string, body: string): MatrixEvent {
        const event = message(sender, body);
        events.push(event);
        room.emit(RoomEvent.Timeline, event, room, false, false, LIVE);
        return event;
    }

    /** Create the view model and let it read the status of the agent */
    async function createViewModel(withAgent = true): Promise<ReplySuggestionsViewModel> {
        vm = new ReplySuggestionsViewModel({ client, room, agent: withAgent ? agent : undefined });
        await vi.advanceTimersByTimeAsync(0);
        return vm;
    }

    beforeEach(() => {
        vi.useFakeTimers({ now: 1_000_000 });
        client = stubClient();
        me = client.getSafeUserId();
        roomId = `!room${++roomCount}:example.org`;
        events = [];
        room = Object.assign(new TypedEventEmitter(), {
            roomId,
            name: "Team",
            getLiveTimeline: () => ({ getEvents: () => events }),
            getMember: (userId: string) => ({ name: userId === me ? "Alice" : "Bob" }),
        }) as unknown as Room;
        DMRoomMap.setShared({ getUserIdForRoomId: () => undefined } as unknown as DMRoomMap);
        vi.spyOn(AgentRoomStore.instance, "isAgentRoom").mockReturnValue(false);
        agent = {
            getStatus: vi.fn().mockResolvedValue({
                provider: "claude",
                instructions: "",
                replySuggestions: true,
                connected: { claude: true, copilot: false },
            }),
            setSettings: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            listModels: vi.fn(),
            getRooms: vi.fn(),
            setRoom: vi.fn(),
            getContactInstructions: vi.fn(),
            setContactInstructions: vi.fn(),
            generateReply: vi.fn(),
            generateSuggestions: vi.fn().mockResolvedValue({ ok: true, data: SUGGESTIONS }),
        };
    });

    afterEach(() => {
        vm?.dispose();
        vm = undefined;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("suggests replies to the latest message of someone else when opened", async () => {
        events.push(message(me, "Who brings the cake?"), message(PARTNER, "I can"));

        await createViewModel();

        expect(agent.generateSuggestions).toHaveBeenCalledWith({
            ownName: "Alice",
            chatName: "Team",
            isDirect: false,
            messages: [
                { sender: me, own: true, text: "Who brings the cake?" },
                { sender: PARTNER, own: false, text: "I can" },
            ],
        });
        expect(vm!.getSnapshot()).toEqual({ suggestions: SUGGESTIONS, loading: false });
    });

    it("names the partner of a direct message, so that their own instructions are used", async () => {
        DMRoomMap.setShared({ getUserIdForRoomId: () => PARTNER } as unknown as DMRoomMap);
        events.push(message(PARTNER, "Hi"));

        await createViewModel();

        expect(agent.generateSuggestions).toHaveBeenCalledWith(
            expect.objectContaining({ isDirect: true, partnerId: PARTNER }),
        );
    });

    it("shows placeholders while the suggestions are written", async () => {
        let finish!: (result: AgentResult<string[]>) => void;
        agent.generateSuggestions.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        events.push(message(PARTNER, "Hi"));

        await createViewModel();
        expect(vm!.getSnapshot()).toEqual({ suggestions: [], loading: true });

        finish({ ok: true, data: SUGGESTIONS });
        await vi.advanceTimersByTimeAsync(0);
        expect(vm!.getSnapshot()).toEqual({ suggestions: SUGGESTIONS, loading: false });
    });

    it("suggests nothing when the user wrote last", async () => {
        events.push(message(PARTNER, "Hi"), message(me, "Hello"));

        await createViewModel();

        expect(agent.generateSuggestions).not.toHaveBeenCalled();
        expect(vm!.getSnapshot()).toEqual({ suggestions: [], loading: false });
    });

    it("suggests nothing without a connected provider or without an agent", async () => {
        events.push(message(PARTNER, "Hi"));
        agent.getStatus.mockResolvedValue({
            provider: "copilot",
            instructions: "",
            replySuggestions: true,
            connected: { claude: true, copilot: false },
        });

        await createViewModel();
        expect(agent.generateSuggestions).not.toHaveBeenCalled();
        vm!.dispose();

        await createViewModel(false);
        expect(vm!.getSnapshot()).toEqual({ suggestions: [], loading: false });
    });

    it("suggests nothing when suggestions are turned off in the settings", async () => {
        events.push(message(PARTNER, "Hi"));
        agent.getStatus.mockResolvedValue({
            provider: "claude",
            instructions: "",
            replySuggestions: false,
            connected: { claude: true, copilot: false },
        });

        await createViewModel();
        receive(PARTNER, "Lunch?");
        await vi.advanceTimersByTimeAsync(SUGGESTION_DELAY_MS);

        expect(agent.generateSuggestions).not.toHaveBeenCalled();
        expect(vm!.getSnapshot()).toEqual({ suggestions: [], loading: false });
    });

    it("leaves rooms where the agent replies by itself alone", async () => {
        vi.mocked(AgentRoomStore.instance.isAgentRoom).mockReturnValue(true);
        events.push(message(PARTNER, "Hi"));

        await createViewModel();

        expect(agent.generateSuggestions).not.toHaveBeenCalled();
    });

    it("writes new suggestions once several new messages have arrived, and clears them when the user replies", async () => {
        await createViewModel();
        expect(agent.generateSuggestions).not.toHaveBeenCalled();

        receive(PARTNER, "Are you there?");
        receive(PARTNER, "Lunch?");
        await vi.advanceTimersByTimeAsync(SUGGESTION_DELAY_MS);

        expect(agent.generateSuggestions).toHaveBeenCalledTimes(1);
        expect(agent.generateSuggestions.mock.calls[0][0].messages.at(-1)).toEqual({
            sender: PARTNER,
            own: false,
            text: "Lunch?",
        });
        expect(vm!.getSnapshot().suggestions).toEqual(SUGGESTIONS);

        receive(me, "Sure!");
        await vi.advanceTimersByTimeAsync(SUGGESTION_DELAY_MS);
        expect(vm!.getSnapshot()).toEqual({ suggestions: [], loading: false });
    });

    it("drops suggestions that a newer message made out of date", async () => {
        let finishFirst!: (result: AgentResult<string[]>) => void;
        agent.generateSuggestions.mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)));
        events.push(message(PARTNER, "Hi"));
        await createViewModel();

        receive(PARTNER, "Lunch?");
        await vi.advanceTimersByTimeAsync(SUGGESTION_DELAY_MS);
        finishFirst({ ok: true, data: ["Hello"] });
        await vi.advanceTimersByTimeAsync(0);

        expect(vm!.getSnapshot()).toEqual({ suggestions: SUGGESTIONS, loading: false });
    });

    it("keeps the suggestions of a room for the next view model", async () => {
        events.push(message(PARTNER, "Hi"));
        await createViewModel();
        vm!.dispose();

        await createViewModel();

        expect(agent.generateSuggestions).toHaveBeenCalledTimes(1);
        expect(vm!.getSnapshot()).toEqual({ suggestions: SUGGESTIONS, loading: false });
    });

    it("shows nothing when the agent fails", async () => {
        agent.generateSuggestions.mockResolvedValue({ ok: false, error: "rate_limited" });
        events.push(message(PARTNER, "Hi"));

        await createViewModel();

        expect(vm!.getSnapshot()).toEqual({ suggestions: [], loading: false });
    });

    it("puts a picked suggestion into the composer and focuses it", async () => {
        const dispatch = vi.spyOn(defaultDispatcher, "dispatch");
        await createViewModel();

        vm!.onSuggestionClick("Sure!");

        expect(dispatch).toHaveBeenCalledWith({
            action: Action.ComposerInsert,
            text: "Sure!",
            timelineRenderingType: TimelineRenderingType.Room,
        });
        expect(dispatch).toHaveBeenCalledWith({ action: Action.FocusSendMessageComposer });
    });
});
