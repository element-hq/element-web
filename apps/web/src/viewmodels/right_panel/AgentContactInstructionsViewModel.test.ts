/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";

import { AgentContactInstructionsViewModel } from "./AgentContactInstructionsViewModel";
import type { AgentApi } from "../../agent/AgentApi";

const PARTNER = "@bob:example.org";
const PATH = "/data/agent/contacts/@bob%3Aexample.org.md";

describe("AgentContactInstructionsViewModel", () => {
    let agent: Mocked<AgentApi>;
    let vm: AgentContactInstructionsViewModel | undefined;

    function createViewModel(): AgentContactInstructionsViewModel {
        vm = new AgentContactInstructionsViewModel({ userId: PARTNER, agent });
        return vm;
    }

    beforeEach(() => {
        agent = {
            getContactInstructions: vi.fn().mockResolvedValue({ ok: true, data: { text: "Be formal.", path: PATH } }),
            setContactInstructions: vi.fn(),
        } as unknown as Mocked<AgentApi>;
    });

    afterEach(() => {
        vm?.dispose();
        vm = undefined;
    });

    it("loads the instructions for the chat partner", async () => {
        const vm = createViewModel();
        expect(vm.getSnapshot().isLoading).toBe(true);

        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));
        expect(agent.getContactInstructions).toHaveBeenCalledWith(PARTNER);
        expect(vm.getSnapshot()).toEqual({
            isLoading: false,
            isBusy: false,
            instructions: "Be formal.",
            filePath: PATH,
            hasError: false,
        });
    });

    it("shows an error when the instructions cannot be read", async () => {
        agent.getContactInstructions.mockRejectedValue(new Error("no IPC"));
        const vm = createViewModel();

        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));
        expect(vm.getSnapshot().hasError).toBe(true);
        expect(vm.getSnapshot().instructions).toBe("");
    });

    it("saves the instructions", async () => {
        agent.setContactInstructions.mockResolvedValue({ ok: true, data: { text: "Be brief.", path: PATH } });
        const vm = createViewModel();
        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));

        const saving = vm.save("Be brief.");
        expect(vm.getSnapshot().isBusy).toBe(true);
        await saving;

        expect(agent.setContactInstructions).toHaveBeenCalledWith(PARTNER, "Be brief.");
        expect(vm.getSnapshot()).toMatchObject({ isBusy: false, instructions: "Be brief.", hasError: false });
    });

    it("keeps the saved instructions when saving fails", async () => {
        agent.setContactInstructions.mockResolvedValue({ ok: false, error: "unavailable" });
        const vm = createViewModel();
        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));

        await vm.save("Be brief.");

        expect(vm.getSnapshot()).toMatchObject({ isBusy: false, instructions: "Be formal.", hasError: true });
    });

    it("ignores results that arrive after being disposed", async () => {
        let resolve!: (value: Awaited<ReturnType<AgentApi["getContactInstructions"]>>) => void;
        agent.getContactInstructions.mockReturnValue(new Promise((r) => (resolve = r)));
        const vm = createViewModel();
        vm.dispose();

        resolve({ ok: true, data: { text: "Be formal.", path: PATH } });
        await Promise.resolve();

        expect(vm.getSnapshot().isLoading).toBe(true);
    });
});
