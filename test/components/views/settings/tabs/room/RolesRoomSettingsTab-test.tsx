/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { fireEvent, getByRole, render, RenderResult, screen, waitFor } from "@testing-library/react";
import { MatrixClient, EventType, MatrixEvent, Room, RoomMember, ISendEventResponse } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { mocked } from "jest-mock";
import { defer } from "matrix-js-sdk/src/utils";
import userEvent from "@testing-library/user-event";

import RolesRoomSettingsTab from "../../../../../../src/components/views/settings/tabs/room/RolesRoomSettingsTab";
import { mkStubRoom, withClientContextRenderOptions, stubClient } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { VoiceBroadcastInfoEventType } from "../../../../../../src/voice-broadcast";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { ElementCall } from "../../../../../../src/models/Call";

describe("RolesRoomSettingsTab", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:example.com";
    let cli: MatrixClient;
    let room: Room;

    const renderTab = (propRoom: Room = room): RenderResult => {
        return render(<RolesRoomSettingsTab room={propRoom} />, withClientContextRenderOptions(cli));
    };

    const getVoiceBroadcastsSelect = (): HTMLElement => {
        return renderTab().container.querySelector("select[label='Voice broadcasts']")!;
    };

    const getVoiceBroadcastsSelectedOption = (): HTMLElement => {
        return renderTab().container.querySelector("select[label='Voice broadcasts'] option:checked")!;
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = mkStubRoom(roomId, "test room", cli);
    });

    it("should allow an Admin to demote themselves but not others", () => {
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
        const { container } = renderTab();

        expect(container.querySelector(`[placeholder="${cli.getUserId()}"]`)).not.toBeDisabled();
        expect(container.querySelector(`[placeholder="@admin:server"]`)).toBeDisabled();
    });

    it("should initially show »Moderator« permission for »Voice broadcasts«", () => {
        expect(getVoiceBroadcastsSelectedOption().textContent).toBe("Moderator");
    });

    describe("when setting »Default« permission for »Voice broadcasts«", () => {
        beforeEach(() => {
            fireEvent.change(getVoiceBroadcastsSelect(), {
                target: { value: 0 },
            });
        });

        it("should update the power levels", () => {
            expect(cli.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPowerLevels, {
                events: {
                    [VoiceBroadcastInfoEventType]: 0,
                },
            });
        });
    });

    describe("Element Call", () => {
        const setGroupCallsEnabled = (val: boolean): void => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
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
                it("defaults to moderator for joining calls", () => {
                    expect(getJoinCallSelectedOption(renderTab())?.textContent).toBe("Moderator");
                });

                it("can change joining calls power level", () => {
                    const tab = renderTab();

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
                it("defaults to moderator for starting calls", () => {
                    expect(getStartCallSelectedOption(renderTab())?.textContent).toBe("Moderator");
                });

                it("can change starting calls power level", () => {
                    const tab = renderTab();

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

        it("hides when group calls disabled", () => {
            setGroupCallsEnabled(false);

            const tab = renderTab();

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
        const { container } = renderTab();

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
