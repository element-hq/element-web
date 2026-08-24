/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, getByRole, render, type RenderResult, screen, waitFor } from "jest-matrix-react";
import {
    type MatrixClient,
    EventType,
    MatrixEvent,
    Room,
    RoomMember,
    type ISendEventResponse,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership, type RoomPowerLevelsEventContent } from "matrix-js-sdk/src/types";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import RolesRoomSettingsTab from "../../../../../../../src/components/views/settings/tabs/room/RolesRoomSettingsTab";
import { mkStubRoom, withClientContextRenderOptions, stubClient } from "../../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import SdkConfig from "../../../../../../../src/SdkConfig";
import { ElementCallEventType, ElementCallMemberEventType } from "../../../../../../../src/call-types";

describe("RolesRoomSettingsTab", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:example.com";
    let cli: MatrixClient;
    let room: Room;

    const renderTab = async (propRoom: Room = room): Promise<RenderResult> => {
        const renderResult = render(<RolesRoomSettingsTab room={propRoom} />, withClientContextRenderOptions(cli));
        // Wait for the tab to be ready
        await waitFor(() => expect(screen.getByText("Permissions")).toBeInTheDocument());
        return renderResult;
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = mkStubRoom(roomId, "test room", cli);
    });

    it("should allow an Admin to demote themselves but not others", async () => {
        mocked(cli.getRoom).mockReturnValue(room);
        // @ts-ignore - mocked doesn't support overloads properly
        mocked(room.currentState.getStateEvents).mockImplementation((type, key) => {
            if (key === undefined) return [] as MatrixEvent[];
            if (type === "m.room.power_levels") {
                return new MatrixEvent({
                    sender: "@sender:server",
                    room_id: roomId,
                    type: "m.room.power_levels",
                    state_key: "",
                    content: {
                        users: {
                            [cli.getUserId()!]: 100,
                            "@admin:server": 100,
                        },
                    },
                });
            }
            return null;
        });
        mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
        const { container } = await renderTab();

        expect(container.querySelector(`[placeholder="${cli.getUserId()}"]`)).not.toBeDisabled();
        expect(container.querySelector(`[placeholder="@admin:server"]`)).toBeDisabled();
    });

    describe("Element Call", () => {
        const setGroupCallsEnabled = (val: boolean): void => {
            SdkConfig.put({ element_call: { disable: !val } });
        };

        afterEach(() => {
            SdkConfig.reset();
        });

        const getStartCallSelect = (tab: RenderResult): HTMLElement => {
            return tab.container.querySelector("select[label='Start Element Call calls']")!;
        };

        const getStartCallSelectedOption = (tab: RenderResult): HTMLElement => {
            return tab.container.querySelector("select[label='Start Element Call calls'] option:checked")!;
        };

        const getJoinCallSelect = (tab: RenderResult): HTMLElement => {
            return tab.container.querySelector("select[label='Join Element Call calls']")!;
        };

        const getJoinCallSelectedOption = (tab: RenderResult): HTMLElement => {
            return tab.container.querySelector("select[label='Join Element Call calls'] option:checked")!;
        };

        describe("Element Call enabled", () => {
            beforeEach(() => {
                setGroupCallsEnabled(true);
            });

            describe("Join Element calls", () => {
                it("defaults to moderator for joining calls", async () => {
                    expect(getJoinCallSelectedOption(await renderTab())?.textContent).toBe("Moderator");
                });

                it("can change joining calls power level", async () => {
                    const tab = await renderTab();

                    fireEvent.change(getJoinCallSelect(tab), {
                        target: { value: 0 },
                    });

                    expect(getJoinCallSelectedOption(tab)?.textContent).toBe("Default");
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPowerLevels, {
                        events: {
                            [ElementCallMemberEventType.name]: 0,
                        },
                    });
                });
            });

            describe("Start Element calls", () => {
                it("defaults to moderator for starting calls", async () => {
                    expect(getStartCallSelectedOption(await renderTab())?.textContent).toBe("Moderator");
                });

                it("can change starting calls power level", async () => {
                    const tab = await renderTab();

                    fireEvent.change(getStartCallSelect(tab), {
                        target: { value: 0 },
                    });

                    expect(getStartCallSelectedOption(tab)?.textContent).toBe("Default");
                    expect(cli.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPowerLevels, {
                        events: {
                            [ElementCallEventType.name]: 0,
                        },
                    });
                });
            });
        });

        it("hides when group calls disabled", async () => {
            setGroupCallsEnabled(false);

            const tab = await renderTab();

            expect(getStartCallSelect(tab)).toBeFalsy();
            expect(getStartCallSelectedOption(tab)).toBeFalsy();

            expect(getJoinCallSelect(tab)).toBeFalsy();
            expect(getJoinCallSelectedOption(tab)).toBeFalsy();
        });
    });

    describe("Banned users", () => {
        it("should not render banned section when no banned users", () => {
            const room = new Room(roomId, cli, userId);
            renderTab(room);

            expect(screen.queryByText("Banned users")).not.toBeInTheDocument();
        });

        it("renders banned users", () => {
            const bannedMember = new RoomMember(roomId, "@bob:server.org");
            bannedMember.setMembershipEvent(
                new MatrixEvent({
                    type: EventType.RoomMember,
                    content: {
                        membership: KnownMembership.Ban,
                        reason: "just testing",
                    },
                    sender: userId,
                }),
            );
            const room = new Room(roomId, cli, userId);
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bannedMember]);
            renderTab(room);

            expect(screen.getByText("Banned users").parentElement).toMatchSnapshot();
        });

        it("uses banners display name when available", () => {
            const bannedMember = new RoomMember(roomId, "@bob:server.org");
            const senderMember = new RoomMember(roomId, "@alice:server.org");
            senderMember.name = "Alice";
            bannedMember.setMembershipEvent(
                new MatrixEvent({
                    type: EventType.RoomMember,
                    content: {
                        membership: KnownMembership.Ban,
                        reason: "just testing",
                    },
                    sender: userId,
                }),
            );
            const room = new Room(roomId, cli, userId);
            jest.spyOn(room, "getMembersWithMembership").mockReturnValue([bannedMember]);
            jest.spyOn(room, "getMember").mockReturnValue(senderMember);
            renderTab(room);

            expect(screen.getByTitle("Banned by Alice")).toBeInTheDocument();
        });
    });

    it("should roll back power level change on error", async () => {
        const deferred = Promise.withResolvers<ISendEventResponse>();
        mocked(cli.sendStateEvent).mockReturnValue(deferred.promise);
        mocked(cli.getRoom).mockReturnValue(room);
        // @ts-ignore - mocked doesn't support overloads properly
        mocked(room.currentState.getStateEvents).mockImplementation((type, key) => {
            if (key === undefined) return [] as MatrixEvent[];
            if (type === "m.room.power_levels") {
                return new MatrixEvent({
                    sender: "@sender:server",
                    room_id: roomId,
                    type: "m.room.power_levels",
                    state_key: "",
                    content: {
                        users: {
                            [cli.getUserId()!]: 100,
                            // needs at least one remaning admin in the room if we want to demote our user
                            // otherwise another modal will be displayed
                            ["@admin:server"]: 100,
                        },
                    },
                });
            }
            return null;
        });
        mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
        mocked(room.getMember).mockReturnValue({ powerLevel: 100 } as any);
        const { container } = await renderTab();

        const selector = container.querySelector(`[placeholder="${cli.getUserId()}"]`)!;
        fireEvent.change(selector, { target: { value: "50" } });
        expect(selector).toHaveValue("50");

        // Get the apply button of the privileged user section and click on it
        const privilegedUsersSection = screen.getByRole("group", { name: "Privileged Users" });
        const applyButton = getByRole(privilegedUsersSection, "button", { name: "Apply" });
        await userEvent.click(applyButton);

        deferred.reject("Error");
        await waitFor(() => expect(selector).toHaveValue("100"));
    });

    it("should allow changing events power levels", async () => {
        mocked(cli.sendStateEvent).mockResolvedValue({ event_id: "$eventId" });
        mocked(cli.getRoom).mockReturnValue(room);
        mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
        const { container } = await renderTab();

        const selector = container.querySelector(`[placeholder="Change topic"]`)!;
        fireEvent.change(selector, { target: { value: "0" } });

        expect(cli.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            "m.room.power_levels",
            expect.objectContaining({
                events: expect.objectContaining({
                    "m.room.topic": 0,
                }),
            }),
        );
    });

    it("should not modify the power levels event when rendering or changing a power level", async () => {
        const plEvent = new MatrixEvent({
            sender: "@sender:server",
            room_id: roomId,
            type: EventType.RoomPowerLevels,
            state_key: "",
            content: {
                users: { [cli.getUserId()!]: 100 },
                events: { [EventType.RoomTopic]: 50 },
                notifications: { room: 50 },
                state_default: 50,
                events_default: 0,
            },
        });
        // Copy the content before rendering: the component would otherwise have mutated the very
        // object we are comparing against, and the assertions would pass for the wrong reason.
        const powerLevels = (): RoomPowerLevelsEventContent => plEvent.getContent<RoomPowerLevelsEventContent>();
        const originalContent = structuredClone(powerLevels());

        mocked(cli.sendStateEvent).mockResolvedValue({ event_id: "$eventId" });
        mocked(cli.getRoom).mockReturnValue(room);
        // @ts-ignore - mocked doesn't support overloads properly
        mocked(room.currentState.getStateEvents).mockImplementation((type, key) => {
            if (key === undefined) return [] as MatrixEvent[];
            if (type === EventType.RoomPowerLevels) return plEvent;
            return null;
        });
        mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
        mocked(room.getMember).mockReturnValue({ powerLevel: 100 } as any);

        await renderTab();
        expect(powerLevels()).toEqual(originalContent);

        fireEvent.change(screen.getByRole("combobox", { name: "Change topic" }), { target: { value: "0" } });
        expect(powerLevels()).toEqual(originalContent);

        // Only the level the user actually changed is sent, rather than every default we displayed
        expect(cli.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPowerLevels, {
            ...originalContent,
            events: { [EventType.RoomTopic]: 0 },
        });
    });

    it("should allow changing top level power levels", async () => {
        mocked(cli.sendStateEvent).mockResolvedValue({ event_id: "$eventId" });
        mocked(cli.getRoom).mockReturnValue(room);
        mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
        const { container } = await renderTab();

        const selector = container.querySelector(`[placeholder="Remove users"]`)!;
        fireEvent.change(selector, { target: { value: "0" } });

        expect(cli.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            "m.room.power_levels",
            expect.objectContaining({
                kick: 0,
            }),
        );
    });

    describe("permission power levels", () => {
        const mockPowerLevels = (content: object, myLevel: number): void => {
            mocked(cli.getRoom).mockReturnValue(room);
            // @ts-ignore - mocked doesn't support overloads properly
            mocked(room.currentState.getStateEvents).mockImplementation((type, key) => {
                if (key === undefined) return [] as MatrixEvent[];
                if (type === "m.room.power_levels") {
                    return new MatrixEvent({
                        sender: "@sender:server",
                        room_id: roomId,
                        type: "m.room.power_levels",
                        state_key: "",
                        content,
                    });
                }
                return null;
            });
            mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
            mocked(room.getMember).mockReturnValue({ powerLevel: myLevel } as any);
        };

        const optionsOf = (container: HTMLElement, label: string): (string | null)[] =>
            Array.from(container.querySelectorAll(`[placeholder="${label}"] option`)).map((o) => o.textContent);

        it("does not offer a moderator power levels above their own", async () => {
            mockPowerLevels(
                { users: { [cli.getUserId()!]: 50 }, state_default: 50, events: { [EventType.RoomTopic]: 50 } },
                50,
            );
            const { container } = await renderTab();

            expect(optionsOf(container, "Change settings")).toEqual(["Default", "Moderator", "Custom level"]);
            expect(optionsOf(container, "Change topic")).toEqual(["Default", "Moderator", "Custom level"]);
        });

        it("offers an admin every power level", async () => {
            mockPowerLevels(
                { users: { [cli.getUserId()!]: 100 }, state_default: 50, events: { [EventType.RoomTopic]: 50 } },
                100,
            );
            const { container } = await renderTab();

            expect(optionsOf(container, "Change settings")).toEqual(["Default", "Moderator", "Admin", "Custom level"]);
        });

        it("keeps showing a level above the user's own when it is already set", async () => {
            mockPowerLevels({ users: { [cli.getUserId()!]: 50 }, state_default: 100 }, 50);
            const { container } = await renderTab();

            expect(optionsOf(container, "Change settings")).toEqual(["Default", "Moderator", "Admin", "Custom level"]);
            expect(container.querySelector(`[placeholder="Change settings"]`)).toBeDisabled();
        });
    });
});
