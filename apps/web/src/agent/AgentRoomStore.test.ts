/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";

import { AgentRoomStore, AgentRoomStoreEvent } from "./AgentRoomStore";
import type { AgentApi } from "./AgentApi";

const ALICE = "@alice:example.org";

describe("AgentRoomStore", () => {
    let agent: Mocked<AgentApi>;
    let store: AgentRoomStore;

    beforeEach(() => {
        agent = {
            getStatus: vi.fn(),
            setSettings: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            listModels: vi.fn(),
            getRooms: vi.fn().mockResolvedValue({ ok: true, data: ["!a:example.org"] }),
            setRoom: vi.fn(async (_userId, roomId, enabled) => ({ ok: true as const, data: enabled ? [roomId] : [] })),
            getReplyMarkings: vi.fn().mockResolvedValue({ ok: true, data: { "!a:example.org": "none" } }),
            setReplyMarking: vi.fn().mockResolvedValue({ ok: true, data: {} }),
            getContactInstructions: vi.fn(),
            setContactInstructions: vi.fn(),
            openContactInstructions: vi.fn(),
            generateReply: vi.fn(),
            generateSuggestions: vi.fn(),
        };
        store = new AgentRoomStore();
    });

    afterEach(() => {
        store.stop();
    });

    it("reads the marked rooms of the user from the platform", async () => {
        const onUpdate = vi.fn();
        store.on(AgentRoomStoreEvent.Update, onUpdate);

        await store.start(agent, ALICE);

        expect(agent.getRooms).toHaveBeenCalledWith(ALICE);
        expect(store.isAvailable).toBe(true);
        expect(store.isAgentRoom("!a:example.org")).toBe(true);
        expect(store.isAgentRoom("!b:example.org")).toBe(false);
        expect(onUpdate).toHaveBeenCalled();
    });

    it("marks nothing on a platform without an agent", async () => {
        await store.start(undefined, ALICE);

        expect(store.isAvailable).toBe(false);
        expect(store.isAgentRoom("!a:example.org")).toBe(false);
    });

    it("marks and unmarks a room, saving it on the platform", async () => {
        await store.start(agent, ALICE);

        const marking = store.setAgentRoom("!b:example.org", true);
        // The mark shows before the platform has saved it
        expect(store.isAgentRoom("!b:example.org")).toBe(true);
        await marking;
        expect(agent.setRoom).toHaveBeenCalledWith(ALICE, "!b:example.org", true);

        await store.setAgentRoom("!a:example.org", false);
        expect(agent.setRoom).toHaveBeenCalledWith(ALICE, "!a:example.org", false);
        expect(store.isAgentRoom("!a:example.org")).toBe(false);
    });

    it("undoes a mark the platform can't save", async () => {
        await store.start(agent, ALICE);
        agent.setRoom.mockResolvedValue({ ok: false, error: "unavailable" });

        await store.setAgentRoom("!b:example.org", true);

        expect(store.isAgentRoom("!b:example.org")).toBe(false);
    });

    it("doesn't save a mark that doesn't change anything", async () => {
        await store.start(agent, ALICE);

        await store.setAgentRoom("!a:example.org", true);

        expect(agent.setRoom).not.toHaveBeenCalled();
    });

    it("forgets the marks when stopped", async () => {
        await store.start(agent, ALICE);

        store.stop();

        expect(store.isAvailable).toBe(false);
        expect(store.isAgentRoom("!a:example.org")).toBe(false);
    });

    it("ignores marks read for a user that logged out meanwhile", async () => {
        let finish: (result: { ok: true; data: string[] }) => void = () => {};
        agent.getRooms.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        const starting = store.start(agent, ALICE);

        store.stop();
        finish({ ok: true, data: ["!a:example.org"] });
        await starting;

        expect(store.isAgentRoom("!a:example.org")).toBe(false);
    });

    it("reads how replies are marked in the rooms of the user", async () => {
        await store.start(agent, ALICE);

        expect(agent.getReplyMarkings).toHaveBeenCalledWith(ALICE);
        expect(store.getReplyMarking("!a:example.org")).toBe("none");
        expect(store.getReplyMarking("!b:example.org")).toBe("notice");
    });

    it("still reads the marked rooms if the reply markings can't be read", async () => {
        agent.getReplyMarkings.mockResolvedValue({ ok: false, error: "unavailable" });

        await store.start(agent, ALICE);

        expect(store.isAgentRoom("!a:example.org")).toBe(true);
        expect(store.getReplyMarking("!a:example.org")).toBe("notice");
    });

    it("changes how replies are marked in a room, saving it on the platform", async () => {
        await store.start(agent, ALICE);
        const onUpdate = vi.fn();
        store.on(AgentRoomStoreEvent.Update, onUpdate);

        const changing = store.setReplyMarking("!b:example.org", "marker");
        // The change shows before the platform has saved it
        expect(store.getReplyMarking("!b:example.org")).toBe("marker");
        await changing;
        expect(agent.setReplyMarking).toHaveBeenCalledWith(ALICE, "!b:example.org", "marker");
        expect(onUpdate).toHaveBeenCalled();

        await store.setReplyMarking("!a:example.org", "notice");
        expect(agent.setReplyMarking).toHaveBeenCalledWith(ALICE, "!a:example.org", "notice");
        expect(store.getReplyMarking("!a:example.org")).toBe("notice");
    });

    it("undoes a reply marking the platform can't save", async () => {
        await store.start(agent, ALICE);
        agent.setReplyMarking.mockResolvedValue({ ok: false, error: "unavailable" });

        await store.setReplyMarking("!a:example.org", "marker");

        expect(store.getReplyMarking("!a:example.org")).toBe("none");
    });

    it("doesn't save a reply marking that doesn't change anything", async () => {
        await store.start(agent, ALICE);

        await store.setReplyMarking("!a:example.org", "none");
        await store.setReplyMarking("!b:example.org", "notice");

        expect(agent.setReplyMarking).not.toHaveBeenCalled();
    });

    it("forgets the reply markings when stopped", async () => {
        await store.start(agent, ALICE);

        store.stop();

        expect(store.getReplyMarking("!a:example.org")).toBe("notice");
    });
});
