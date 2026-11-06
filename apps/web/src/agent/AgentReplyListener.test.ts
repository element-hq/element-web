/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import {
    MsgType,
    RoomEvent,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk/src/matrix";
import { mkEvent, mkMessage, stubClient } from "test-utils";

import { AgentReplyListener, REPLY_DELAY_MS } from "./AgentReplyListener";
import type { AgentApi } from "./AgentApi";
import DMRoomMap from "../utils/DMRoomMap";
import { AgentRoomStore } from "./AgentRoomStore";

const ROOM_ID = "!dm:example.org";
const PARTNER = "@bob:example.org";
/** The timeline data of an event that just arrived; the listener only reads `liveEvent` */
const LIVE = { liveEvent: true } as IRoomTimelineData;

describe("AgentReplyListener", () => {
    let client: MatrixClient;
    let agent: Mocked<AgentApi>;
    let room: Room;
    let events: MatrixEvent[];
    let listener: AgentReplyListener;
    let me: string;

    /** A message in the DM, appended to its timeline and announced as a live event */
    function receive(sender: string, body: string, msgtype: string = MsgType.Text): MatrixEvent {
        const event = mkMessage({ room: ROOM_ID, user: sender, msg: body, ts: Date.now(), event: true });
        event.getContent().msgtype = msgtype;
        events.push(event);
        client.emit(RoomEvent.Timeline, event, room, false, false, LIVE);
        return event;
    }

    /** Let the reply delay pass and the reply be written */
    async function waitForReply(): Promise<void> {
        await vi.advanceTimersByTimeAsync(REPLY_DELAY_MS);
    }

    beforeEach(() => {
        vi.useFakeTimers({ now: 1_000_000 });
        client = stubClient();
        me = client.getSafeUserId();
        events = [];
        room = {
            roomId: ROOM_ID,
            getLiveTimeline: () => ({ getEvents: () => events }),
            getMember: (userId: string) => ({ name: userId === me ? "Alice" : "Bob" }),
        } as unknown as Room;
        DMRoomMap.setShared({
            getUserIdForRoomId: (roomId: string) => (roomId === ROOM_ID ? PARTNER : undefined),
        } as unknown as DMRoomMap);
        vi.spyOn(AgentRoomStore.instance, "isAgentRoom").mockImplementation((roomId) => roomId === ROOM_ID);
        agent = {
            getStatus: vi.fn(),
            setSettings: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            listModels: vi.fn(),
            getRooms: vi.fn(),
            setRoom: vi.fn(),
            generateReply: vi.fn().mockResolvedValue({ ok: true, data: "Sure, see you tomorrow!" }),
        };
        listener = new AgentReplyListener();
        listener.start(client, agent);
    });

    afterEach(() => {
        listener.stop();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("replies to the partner in a direct message marked for the agent, as a notice", async () => {
        events.push(mkMessage({ room: ROOM_ID, user: me, msg: "Hi Bob", ts: 1, event: true }));
        receive(PARTNER, "Are you free tomorrow?");

        await waitForReply();

        expect(agent.generateReply).toHaveBeenCalledWith({
            ownName: "Alice",
            partnerName: "Bob",
            turns: [
                { role: "assistant", text: "Hi Bob" },
                { role: "user", text: "Are you free tomorrow?" },
            ],
        });
        expect(client.sendMessage).toHaveBeenCalledWith(ROOM_ID, {
            msgtype: MsgType.Notice,
            body: "Sure, see you tomorrow!",
        });
        expect(client.sendTyping).toHaveBeenCalledWith(ROOM_ID, true, 30000);
        expect(client.sendTyping).toHaveBeenLastCalledWith(ROOM_ID, false, 0);
    });

    it("waits for the partner to finish writing and replies once", async () => {
        receive(PARTNER, "Hi");
        await vi.advanceTimersByTimeAsync(REPLY_DELAY_MS - 1000);
        receive(PARTNER, "Are you free tomorrow?");
        await vi.advanceTimersByTimeAsync(REPLY_DELAY_MS - 1000);
        expect(agent.generateReply).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1000);

        expect(agent.generateReply).toHaveBeenCalledTimes(1);
        expect(agent.generateReply.mock.calls[0][0].turns).toEqual([
            { role: "user", text: "Hi" },
            { role: "user", text: "Are you free tomorrow?" },
        ]);
    });

    it("does not reply in a direct message that is not marked for the agent", async () => {
        vi.mocked(AgentRoomStore.instance.isAgentRoom).mockReturnValue(false);
        receive(PARTNER, "Hi");

        await waitForReply();

        expect(agent.generateReply).not.toHaveBeenCalled();
    });

    it("does not reply in a room that is not a direct message", async () => {
        DMRoomMap.setShared({ getUserIdForRoomId: () => undefined } as unknown as DMRoomMap);
        receive(PARTNER, "Hi");

        await waitForReply();

        expect(agent.generateReply).not.toHaveBeenCalled();
    });

    it.each([
        ["the user's own message", () => receive("@userId:matrix.org", "Hi")],
        ["an automated notice of the partner", () => receive(PARTNER, "Hi", MsgType.Notice)],
        [
            "an event that is not a message",
            () => {
                const event = mkEvent({ type: "m.reaction", room: ROOM_ID, user: PARTNER, content: {}, event: true });
                client.emit(RoomEvent.Timeline, event, room, false, false, LIVE);
            },
        ],
    ])("does not reply to %s", async (_, send) => {
        send();

        await waitForReply();

        expect(agent.generateReply).not.toHaveBeenCalled();
    });

    it("does not reply to messages sent before it started", async () => {
        const event = mkMessage({ room: ROOM_ID, user: PARTNER, msg: "Old", ts: 1, event: true });
        events.push(event);
        client.emit(RoomEvent.Timeline, event, room, false, false, LIVE);

        await waitForReply();

        expect(agent.generateReply).not.toHaveBeenCalled();
    });

    it("does not send a reply when the user wrote in the meantime", async () => {
        let finishReply: (result: { ok: true; data: string }) => void = () => {};
        agent.generateReply.mockReturnValue(new Promise((resolve) => (finishReply = resolve)));
        receive(PARTNER, "Are you free tomorrow?");
        await waitForReply();

        events.push(mkMessage({ room: ROOM_ID, user: me, msg: "Yes!", ts: Date.now(), event: true }));
        finishReply({ ok: true, data: "Sure" });
        await vi.runAllTimersAsync();

        expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it("does not send anything when the agent fails", async () => {
        agent.generateReply.mockResolvedValue({ ok: false, error: "rate_limited" });
        receive(PARTNER, "Hi");

        await waitForReply();

        expect(client.sendMessage).not.toHaveBeenCalled();
        expect(client.sendTyping).toHaveBeenLastCalledWith(ROOM_ID, false, 0);
    });

    it("stops replying once stopped", async () => {
        receive(PARTNER, "Hi");
        listener.stop();

        await waitForReply();
        receive(PARTNER, "Hello?");
        await waitForReply();

        expect(agent.generateReply).not.toHaveBeenCalled();
    });

    it("does nothing on a platform without an agent", async () => {
        listener.start(client, undefined);
        receive(PARTNER, "Hi");

        await waitForReply();

        expect(agent.generateReply).not.toHaveBeenCalled();
    });
});
