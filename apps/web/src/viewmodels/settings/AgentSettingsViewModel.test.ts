/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import type { AgentStatus } from "shared-types";

import { AgentSettingsViewModel, toSettingsError } from "./AgentSettingsViewModel";
import type { AgentApi } from "../../agent/AgentApi";

const MODELS = [{ id: "claude-opus-5-5", name: "Claude Opus 5.5" }];

describe("AgentSettingsViewModel", () => {
    let agent: Mocked<AgentApi>;
    let vm: AgentSettingsViewModel;

    function mkAgent(status: Partial<AgentStatus> = {}): Mocked<AgentApi> {
        return {
            getStatus: vi.fn().mockResolvedValue({
                provider: "claude",
                instructions: "Be brief.",
                replySuggestions: true,
                connected: { claude: true, copilot: false },
                ...status,
            }),
            setSettings: vi.fn(async (changes) => ({
                ok: true as const,
                data: { provider: "claude" as const, instructions: "", replySuggestions: true, ...changes },
            })),
            connect: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
            disconnect: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
            getCopilotAccount: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: true, login: "octocat" } }),
            connectCopilotAccount: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
            signInCopilot: vi.fn().mockResolvedValue({ ok: true, data: { signedIn: true, login: "octocat" } }),
            cancelCopilotSignIn: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
            listModels: vi.fn().mockResolvedValue({ ok: true, data: MODELS }),
            getRooms: vi.fn(),
            setRoom: vi.fn(),
            generateReply: vi.fn(),
            generateSuggestions: vi.fn(),
        };
    }

    async function createLoaded(status: Partial<AgentStatus> = {}): Promise<void> {
        agent = mkAgent(status);
        vm = new AgentSettingsViewModel({ agent });
        await vi.waitFor(() => expect(vm.getSnapshot().isLoading).toBe(false));
    }

    afterEach(() => {
        vm?.dispose();
    });

    describe("loading", () => {
        it("starts loading", () => {
            agent = mkAgent();
            vm = new AgentSettingsViewModel({ agent });
            expect(vm.getSnapshot()).toMatchObject({ isLoading: true, isBusy: false });
        });

        it("shows the settings and the models of a connected provider", async () => {
            await createLoaded({ model: "claude-opus-5-5" });

            await vi.waitFor(() => expect(vm.getSnapshot().models).toEqual(MODELS));
            expect(vm.getSnapshot()).toMatchObject({
                provider: "claude",
                connected: { claude: true, copilot: false },
                model: "claude-opus-5-5",
                instructions: "Be brief.",
            });
            expect(agent.listModels).toHaveBeenCalledWith("claude");
        });

        it("doesn't list models of a provider that is not connected", async () => {
            await createLoaded({ connected: { claude: false, copilot: false } });

            expect(agent.listModels).not.toHaveBeenCalled();
            expect(vm.getSnapshot().models).toEqual([]);
        });

        it("shows an error when the models can't be listed", async () => {
            agent = mkAgent();
            agent.listModels.mockResolvedValue({ ok: false, error: "invalid_credential" });
            vm = new AgentSettingsViewModel({ agent });

            await vi.waitFor(() => expect(vm.getSnapshot().error).toBe("invalid_credential"));
        });
    });

    describe("actions", () => {
        beforeEach(async () => {
            await createLoaded({ connected: { claude: false, copilot: false } });
        });

        it("connects the selected provider and lists its models", async () => {
            vm.connect("sk-ant-test");
            expect(vm.getSnapshot().isBusy).toBe(true);

            await vi.waitFor(() => expect(vm.getSnapshot().models).toEqual(MODELS));
            expect(agent.connect).toHaveBeenCalledWith("claude", "sk-ant-test");
            expect(vm.getSnapshot()).toMatchObject({ isBusy: false, connected: { claude: true, copilot: false } });
        });

        it("shows why a credential was not accepted", async () => {
            agent.connect.mockResolvedValue({ ok: false, error: "invalid_credential" });

            vm.connect("sk-ant-wrong");

            await vi.waitFor(() => expect(vm.getSnapshot().error).toBe("invalid_credential"));
            expect(vm.getSnapshot()).toMatchObject({ isBusy: false, connected: { claude: false, copilot: false } });
        });

        it("switches the provider", async () => {
            vm.setProvider("copilot");

            await vi.waitFor(() => expect(vm.getSnapshot().provider).toBe("copilot"));
            expect(agent.setSettings).toHaveBeenCalledWith({ provider: "copilot" });
        });

        it("disconnects the selected provider", async () => {
            vm.connect("sk-ant-test");
            await vi.waitFor(() => expect(vm.getSnapshot().connected.claude).toBe(true));

            vm.disconnect();

            await vi.waitFor(() => expect(vm.getSnapshot().connected.claude).toBe(false));
            expect(agent.disconnect).toHaveBeenCalledWith("claude");
            expect(vm.getSnapshot().models).toEqual([]);
        });

        it("saves the model and the instructions", async () => {
            vm.setModel("claude-sonnet-5-5");
            await vi.waitFor(() => expect(vm.getSnapshot().model).toBe("claude-sonnet-5-5"));

            vm.saveInstructions("I'm on holiday.");
            await vi.waitFor(() => expect(vm.getSnapshot().instructions).toBe("I'm on holiday."));
            expect(agent.setSettings).toHaveBeenCalledWith({ instructions: "I'm on holiday." });
        });

        it("shows and changes whether replies are suggested", async () => {
            expect(vm.getSnapshot().replySuggestions).toBe(true);

            vm.setReplySuggestions(false);
            await vi.waitFor(() => expect(vm.getSnapshot().replySuggestions).toBe(false));
            expect(agent.setSettings).toHaveBeenCalledWith({ replySuggestions: false });
        });
    });

    describe("the Copilot account of the computer", () => {
        const notConnected = { connected: { claude: false, copilot: false } };

        it("offers the account when Copilot is selected and not connected", async () => {
            await createLoaded({ provider: "copilot", ...notConnected });

            await vi.waitFor(() =>
                expect(vm.getSnapshot().copilotAccount).toEqual({ signedIn: true, login: "octocat" }),
            );
        });

        it("shows the account Copilot is connected with", async () => {
            await createLoaded({
                provider: "copilot",
                connected: { claude: false, copilot: true },
                copilotAuth: "account",
            });

            await vi.waitFor(() => expect(vm.getSnapshot().copilotAccount?.login).toBe("octocat"));
            expect(vm.getSnapshot().copilotAuth).toBe("account");
            expect(agent.listModels).toHaveBeenCalledWith("copilot");
        });

        it("doesn't look up the account when Copilot is connected with a token, or not selected", async () => {
            await createLoaded({
                provider: "copilot",
                connected: { claude: false, copilot: true },
                copilotAuth: "token",
            });
            await vi.waitFor(() => expect(vm.getSnapshot().models).toEqual(MODELS));
            expect(agent.getCopilotAccount).not.toHaveBeenCalled();
            vm.dispose();
            await createLoaded(notConnected);

            expect(agent.getCopilotAccount).not.toHaveBeenCalled();
        });

        it("looks up the account when switching to Copilot", async () => {
            await createLoaded(notConnected);

            vm.setProvider("copilot");

            await vi.waitFor(() => expect(vm.getSnapshot().copilotAccount?.signedIn).toBe(true));
        });

        it("connects Copilot with the account", async () => {
            await createLoaded({ provider: "copilot", ...notConnected });

            vm.connectCopilotAccount();

            await vi.waitFor(() => expect(vm.getSnapshot().connected.copilot).toBe(true));
            expect(vm.getSnapshot().copilotAuth).toBe("account");
            await vi.waitFor(() => expect(vm.getSnapshot().models).toEqual(MODELS));
        });

        it("signs in in the browser and connects Copilot with the new account", async () => {
            await createLoaded({ provider: "copilot", ...notConnected });
            agent.getCopilotAccount.mockResolvedValue({ ok: true, data: { signedIn: false } });

            vm.signInCopilot();
            expect(vm.getSnapshot()).toMatchObject({ isSigningIn: true, isBusy: true });

            await vi.waitFor(() => expect(vm.getSnapshot().isSigningIn).toBe(false));
            expect(vm.getSnapshot()).toMatchObject({
                isBusy: false,
                connected: { copilot: true },
                copilotAuth: "account",
                copilotAccount: { signedIn: true, login: "octocat" },
            });
        });

        it("ends a cancelled sign-in without an error", async () => {
            await createLoaded({ provider: "copilot", ...notConnected });
            let finish!: (result: { ok: false; error: "cancelled" }) => void;
            agent.signInCopilot.mockReturnValue(new Promise((resolve) => (finish = resolve)));
            agent.cancelCopilotSignIn.mockImplementation(async () => {
                finish({ ok: false, error: "cancelled" });
                return { ok: true, data: undefined };
            });

            vm.signInCopilot();
            vm.cancelCopilotSignIn();

            await vi.waitFor(() => expect(vm.getSnapshot().isSigningIn).toBe(false));
            expect(vm.getSnapshot()).toMatchObject({ isBusy: false, error: undefined, connected: { copilot: false } });
        });

        it("cancels a sign-in when the settings are closed", async () => {
            await createLoaded({ provider: "copilot", ...notConnected });
            agent.signInCopilot.mockReturnValue(new Promise(() => {}));

            vm.signInCopilot();
            vm.dispose();

            expect(agent.cancelCopilotSignIn).toHaveBeenCalled();
        });

        it("offers the account again after disconnecting Copilot", async () => {
            await createLoaded({
                provider: "copilot",
                connected: { claude: false, copilot: true },
                copilotAuth: "token",
            });

            vm.disconnect();

            await vi.waitFor(() => expect(vm.getSnapshot().copilotAccount?.signedIn).toBe(true));
            expect(vm.getSnapshot()).toMatchObject({ connected: { copilot: false }, copilotAuth: undefined });
        });
    });

    describe("toSettingsError", () => {
        it.each([
            ["invalid_credential", "invalid_credential"],
            ["rate_limited", "rate_limited"],
            ["unavailable", "unavailable"],
            ["refused", "unknown"],
            ["not_connected", "unknown"],
            ["cancelled", undefined],
        ] as const)("shows %s as %s", (error, expected) => {
            expect(toSettingsError(error)).toBe(expected);
        });
    });
});
