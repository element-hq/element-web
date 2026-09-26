// @vitest-environment happy-dom

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixClient, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi, type MockedObject } from "vitest";

import { PolicyServerViewModel } from "./PolicyServerViewModel";
import { type PolicyServerDiscovery } from "../../../utils/PolicyServerDiscovery";
import {
    getMockClientWithEventEmitter,
    mkEvent,
    mkRoomCreateEvent,
    mockClientMethodsUser,
} from "../../../../test/test-utils";

const ROOM_ID = "!room:example.org";
const USER_ID = "@alice:example.org";
const PUBLIC_KEYS = { ed25519: "not_a_real_key" };

describe("PolicyServerViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let room: Room;
    let discovery: MockedObject<PolicyServerDiscovery>;

    function stateEvent(type: string, content: object, stateKey = ""): MatrixEvent {
        return mkEvent({ event: true, type, room: ROOM_ID, user: USER_ID, skey: stateKey, content });
    }

    function membership(userId: string): MatrixEvent {
        return stateEvent(EventType.RoomMember, { membership: "join" }, userId);
    }

    function powerLevels(userLevel: number): MatrixEvent {
        return stateEvent(EventType.RoomPowerLevels, { users: { [USER_ID]: userLevel }, state_default: 50 });
    }

    function stablePolicy(via: string): MatrixEvent {
        return stateEvent(EventType.RoomPolicy, { via, public_keys: PUBLIC_KEYS });
    }

    function legacyPolicy(via: string): MatrixEvent {
        return stateEvent(EventType.RoomPolicyUnstable, { via, public_key: "not_a_real_key" });
    }

    function createViewModel(): PolicyServerViewModel {
        return new PolicyServerViewModel({ room, discovery });
    }

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(USER_ID),
            sendStateEvent: vi.fn().mockResolvedValue({ event_id: "$event" }),
        });
        room = new Room(ROOM_ID, client, USER_ID);
        // Power levels only apply to members of a room with a create event.
        room.currentState.setStateEvents([mkRoomCreateEvent(USER_ID, ROOM_ID), membership(USER_ID), powerLevels(100)]);
        discovery = {
            lookupPolicyServer: vi.fn().mockResolvedValue({ public_keys: PUBLIC_KEYS }),
            lookupSupportPage: vi.fn().mockResolvedValue(undefined),
        };
    });

    describe("initial snapshot", () => {
        it("reflects a room without a policy server", () => {
            const vm = createViewModel();

            expect(vm.getSnapshot()).toEqual({
                serverName: "",
                currentServerName: "",
                isLegacyConfig: false,
                canChange: true,
                canApply: false,
                busy: false,
                error: null,
                supportUrl: null,
            });
            expect(discovery.lookupSupportPage).not.toHaveBeenCalled();
        });

        it("reflects a room with a policy server and looks up its support page", async () => {
            room.currentState.setStateEvents([stablePolicy("policy.example.org")]);
            discovery.lookupSupportPage.mockResolvedValue("https://policy.example.org/support");

            const vm = createViewModel();

            expect(vm.getSnapshot()).toMatchObject({
                serverName: "policy.example.org",
                currentServerName: "policy.example.org",
                isLegacyConfig: false,
                canApply: false,
            });
            expect(discovery.lookupSupportPage).toHaveBeenCalledWith("policy.example.org");
            await waitFor(() => expect(vm.getSnapshot().supportUrl).toBe("https://policy.example.org/support"));
        });

        it("reflects a room configured with the pre-stabilisation event and allows re-applying it", () => {
            room.currentState.setStateEvents([legacyPolicy("legacy.example.org")]);

            const vm = createViewModel();

            expect(vm.getSnapshot()).toMatchObject({
                serverName: "legacy.example.org",
                currentServerName: "legacy.example.org",
                isLegacyConfig: true,
                canApply: true,
            });
        });

        it("prefers the stable event when both exist", () => {
            room.currentState.setStateEvents([legacyPolicy("legacy.example.org"), stablePolicy("policy.example.org")]);

            const vm = createViewModel();

            expect(vm.getSnapshot()).toMatchObject({
                currentServerName: "policy.example.org",
                isLegacyConfig: false,
                canApply: false,
            });
        });

        it("does not allow changes without permission", () => {
            room.currentState.setStateEvents([powerLevels(0)]);

            const vm = createViewModel();

            expect(vm.getSnapshot()).toMatchObject({ canChange: false, canApply: false });
        });
    });

    describe("setServerName", () => {
        it("enables applying once the value differs from the room's", () => {
            const vm = createViewModel();

            vm.setServerName("policy.example.org");
            expect(vm.getSnapshot()).toMatchObject({ serverName: "policy.example.org", canApply: true });

            vm.setServerName("");
            expect(vm.getSnapshot()).toMatchObject({ serverName: "", canApply: false });
        });

        it("treats a value that normalises to the current one as unchanged", () => {
            room.currentState.setStateEvents([stablePolicy("policy.example.org")]);
            const vm = createViewModel();

            vm.setServerName("  https://policy.example.org/ ");
            expect(vm.getSnapshot().canApply).toBe(false);
        });

        it("clears a previous error", async () => {
            discovery.lookupPolicyServer.mockRejectedValue(new Error("nope"));
            const vm = createViewModel();
            vm.setServerName("policy.example.org");
            await vm.apply();
            expect(vm.getSnapshot().error).toBe("lookup_failed");

            vm.setServerName("other.example.org");
            expect(vm.getSnapshot().error).toBeNull();
        });
    });

    describe("apply", () => {
        it("looks up the policy server and sends the stable state event", async () => {
            const vm = createViewModel();
            vm.setServerName("https://policy.example.org/");

            const promise = vm.apply();
            expect(vm.getSnapshot()).toMatchObject({ busy: true, canApply: false, serverName: "policy.example.org" });
            await promise;

            expect(discovery.lookupPolicyServer).toHaveBeenCalledWith("policy.example.org");
            expect(client.sendStateEvent).toHaveBeenCalledTimes(1);
            expect(client.sendStateEvent).toHaveBeenCalledWith(
                ROOM_ID,
                EventType.RoomPolicy,
                { via: "policy.example.org", public_keys: PUBLIC_KEYS },
                "",
            );
            expect(vm.getSnapshot()).toMatchObject({
                busy: false,
                error: null,
                currentServerName: "policy.example.org",
                canApply: false,
            });
        });

        it("clears the policy server when the input is empty", async () => {
            room.currentState.setStateEvents([stablePolicy("policy.example.org")]);
            const vm = createViewModel();
            vm.setServerName("");

            await vm.apply();

            expect(discovery.lookupPolicyServer).not.toHaveBeenCalled();
            expect(client.sendStateEvent).toHaveBeenCalledWith(ROOM_ID, EventType.RoomPolicy, {}, "");
            expect(vm.getSnapshot()).toMatchObject({ currentServerName: "", canApply: false });
        });

        it("also clears a pre-stabilisation event when migrating it", async () => {
            room.currentState.setStateEvents([legacyPolicy("legacy.example.org")]);
            const vm = createViewModel();

            await vm.apply();

            expect(client.sendStateEvent).toHaveBeenCalledWith(
                ROOM_ID,
                EventType.RoomPolicy,
                { via: "legacy.example.org", public_keys: PUBLIC_KEYS },
                "",
            );
            expect(client.sendStateEvent).toHaveBeenCalledWith(ROOM_ID, EventType.RoomPolicyUnstable, {}, "");
            expect(vm.getSnapshot()).toMatchObject({ isLegacyConfig: false, canApply: false });
        });

        it("reports a lookup failure without touching room state", async () => {
            discovery.lookupPolicyServer.mockRejectedValue(new Error("HTTP 404"));
            const vm = createViewModel();
            vm.setServerName("not-a-policy-server.example.org");

            await vm.apply();

            expect(client.sendStateEvent).not.toHaveBeenCalled();
            expect(vm.getSnapshot()).toMatchObject({ busy: false, error: "lookup_failed", canApply: true });
        });

        it("reports a failure to send the state event", async () => {
            client.sendStateEvent.mockRejectedValue(new Error("M_FORBIDDEN"));
            const vm = createViewModel();
            vm.setServerName("policy.example.org");

            await vm.apply();

            expect(vm.getSnapshot()).toMatchObject({ busy: false, error: "update_failed", currentServerName: "" });
        });

        it("does nothing when the value is unchanged", async () => {
            const vm = createViewModel();

            await vm.apply();

            expect(discovery.lookupPolicyServer).not.toHaveBeenCalled();
            expect(client.sendStateEvent).not.toHaveBeenCalled();
        });

        it("does nothing without permission", async () => {
            room.currentState.setStateEvents([powerLevels(0)]);
            const vm = createViewModel();
            vm.setServerName("policy.example.org");

            await vm.apply();

            expect(client.sendStateEvent).not.toHaveBeenCalled();
        });
    });

    describe("room state updates", () => {
        it("follows the room when the user has not edited the value", async () => {
            discovery.lookupSupportPage.mockResolvedValue("https://policy.example.org/support");
            const vm = createViewModel();

            room.currentState.setStateEvents([stablePolicy("policy.example.org")]);

            expect(vm.getSnapshot()).toMatchObject({
                serverName: "policy.example.org",
                currentServerName: "policy.example.org",
                canApply: false,
            });
            await waitFor(() => expect(vm.getSnapshot().supportUrl).toBe("https://policy.example.org/support"));
        });

        it("keeps the user's edit when the room changes underneath", () => {
            const vm = createViewModel();
            vm.setServerName("mine.example.org");

            room.currentState.setStateEvents([stablePolicy("theirs.example.org")]);

            expect(vm.getSnapshot()).toMatchObject({
                serverName: "mine.example.org",
                currentServerName: "theirs.example.org",
                canApply: true,
            });
        });

        it("updates permissions when power levels change", () => {
            const vm = createViewModel();
            expect(vm.getSnapshot().canChange).toBe(true);

            room.currentState.setStateEvents([powerLevels(0)]);

            expect(vm.getSnapshot()).toMatchObject({ canChange: false, canApply: false });
        });

        it("stops listening once disposed", () => {
            const vm = createViewModel();
            vm.dispose();

            room.currentState.setStateEvents([stablePolicy("policy.example.org")]);

            expect(vm.getSnapshot().currentServerName).toBe("");
        });
    });
});
