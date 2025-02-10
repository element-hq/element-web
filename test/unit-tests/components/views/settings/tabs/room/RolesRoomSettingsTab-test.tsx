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
import { KnownMembership } from "matrix-js-sdk/src/types";
import { mocked } from "jest-mock";
import { defer } from "matrix-js-sdk/src/utils";
import userEvent from "@testing-library/user-event";

import RolesRoomSettingsTab from "../../../../../../../src/components/views/settings/tabs/room/RolesRoomSettingsTab";
import { mkStubRoom, withClientContextRenderOptions, stubClient } from "../../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import { ElementCall } from "../../../../../../../src/models/Call";

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
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string): any => {
                if (name === "feature_group_calls") return val;
            });
        };

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
                            [ElementCall.MEMBER_EVENT_TYPE.name]: 0,
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
                            [ElementCall.CALL_EVENT_TYPE.name]: 0,
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
        const deferred = defer<ISendEventResponse>();
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
                        },
                    },
                });
            }
            return null;
        });
        mocked(room.currentState.mayClientSendStateEvent).mockReturnValue(true);
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
});
