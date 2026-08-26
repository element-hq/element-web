/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { act, fireEvent, render, type RenderResult } from "test-utils-rtl";
import {
    EventType,
    type MatrixClient,
    type Room,
    GuestAccess,
    HistoryVisibility,
    JoinRule,
    Visibility,
} from "matrix-js-sdk/src/matrix";
import {
    createTestClient,
    mkEvent,
    wrapInMatrixClientContext,
    mkSpace,
    mockStateEventImplementation,
} from "test-utils";

import _SpaceSettingsVisibilityTab from "./SpaceSettingsVisibilityTab";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

const SpaceSettingsVisibilityTab = wrapInMatrixClientContext(_SpaceSettingsVisibilityTab);

vi.mock("matrix-js-sdk/src/randomstring", async () => ({
    ...(await vi.importActual("matrix-js-sdk/src/randomstring")),
    secureRandomString: vi.fn(),
}));

vi.useFakeTimers();

describe("<SpaceSettingsVisibilityTab />", () => {
    const mockMatrixClient = createTestClient() as MatrixClient;
    vi.mocked(mockMatrixClient.isVersionSupported).mockImplementation(async (v) => v === "v1.4");

    const makeJoinEvent = (rule: JoinRule = JoinRule.Invite) =>
        mkEvent({
            type: EventType.RoomJoinRules,
            event: true,
            content: {
                join_rule: rule,
            },
        } as any);
    const makeGuestAccessEvent = (rule: GuestAccess = GuestAccess.CanJoin) =>
        mkEvent({
            type: EventType.RoomGuestAccess,
            event: true,
            content: {
                guest_access: rule,
            },
        } as any);
    const makeHistoryEvent = (rule: HistoryVisibility = HistoryVisibility.Shared) =>
        mkEvent({
            type: EventType.RoomHistoryVisibility,
            event: true,
            content: {
                history_visibility: rule,
            },
        } as any);

    const mockSpaceId = "mock-space";

    // TODO case for canonical
    const makeMockSpace = (
        client: MatrixClient,
        joinRule: JoinRule = JoinRule.Invite,
        guestRule: GuestAccess = GuestAccess.CanJoin,
        historyRule: HistoryVisibility = HistoryVisibility.WorldReadable,
    ): Room => {
        const events = [makeJoinEvent(joinRule), makeGuestAccessEvent(guestRule), makeHistoryEvent(historyRule)];
        const space = mkSpace(client, mockSpaceId);
        vi.mocked(client.getRoom).mockImplementation((roomId) => (roomId === mockSpaceId ? space : null));
        const getStateEvents = mockStateEventImplementation(events);
        vi.mocked(space.currentState).getStateEvents.mockImplementation(getStateEvents);
        vi.mocked(space.currentState).mayClientSendStateEvent.mockReturnValue(false);
        space.getJoinRule.mockReturnValue(joinRule);
        vi.mocked(space.currentState).getJoinRule.mockReturnValue(joinRule);
        return space as unknown as Room;
    };
    const defaultProps = {
        matrixClient: mockMatrixClient,
        space: makeMockSpace(mockMatrixClient),
        closeSettingsFn: vi.fn(),
    };

    const getComponent = (props = {}) => {
        return render(<SpaceSettingsVisibilityTab {...defaultProps} {...props} />);
    };

    const toggleGuestAccessSection = async ({ getByTestId }: RenderResult) => {
        const toggleButton = getByTestId("toggle-guest-access-btn")!;
        fireEvent.click(toggleButton);
    };
    const getGuestAccessToggle = ({ getByLabelText }: RenderResult) => getByLabelText("Enable guest access");
    const getHistoryVisibilityToggle = ({ getByLabelText }: RenderResult) => getByLabelText("Preview space");
    const getErrorMessage = ({ getByTestId }: RenderResult) => getByTestId("space-settings-error")?.textContent;

    beforeEach(() => {
        let i = 0;
        vi.mocked(secureRandomString).mockImplementation(() => {
            return "testid_" + i++;
        });

        vi.mocked(mockMatrixClient.sendStateEvent).mockClear().mockResolvedValue({ event_id: "$event1" });
        MatrixClientPeg.get = vi.fn().mockReturnValue(mockMatrixClient);
        MatrixClientPeg.safeGet = vi.fn().mockReturnValue(mockMatrixClient);
    });

    afterEach(() => {
        vi.runAllTimers();
    });

    it("renders container", () => {
        const { asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("for a private space", () => {
        const joinRule = JoinRule.Invite;
        it("does not render addresses section", () => {
            const space = makeMockSpace(mockMatrixClient, joinRule);
            const { queryByTestId } = getComponent({ space });

            expect(queryByTestId("published-address-fieldset")).toBeFalsy();
            expect(queryByTestId("local-address-fieldset")).toBeFalsy();
        });
    });

    describe("for a public space", () => {
        const joinRule = JoinRule.Public;
        const guestRule = GuestAccess.CanJoin;
        const historyRule = HistoryVisibility.Joined;
        vi.mocked(mockMatrixClient.getRoomDirectoryVisibility).mockResolvedValue({ visibility: Visibility.Public });

        describe("Access", () => {
            it("renders guest access section toggle", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                const component = getComponent({ space });

                await toggleGuestAccessSection(component);

                expect(getGuestAccessToggle(component)).toMatchSnapshot();
            });

            it("send guest access event on toggle", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);

                const component = getComponent({ space });
                await toggleGuestAccessSection(component);
                const guestAccessInput = getGuestAccessToggle(component);

                expect(guestAccessInput).toBeChecked();

                fireEvent.click(guestAccessInput!);
                expect(mockMatrixClient.sendStateEvent).toHaveBeenCalledWith(
                    mockSpaceId,
                    EventType.RoomGuestAccess,
                    // toggled off
                    { guest_access: GuestAccess.Forbidden },
                    "",
                );

                // toggled off
                expect(guestAccessInput).not.toBeChecked();
            });

            it("renders error message when update fails", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                vi.mocked(mockMatrixClient.sendStateEvent).mockRejectedValue({});
                const component = getComponent({ space });
                await toggleGuestAccessSection(component);
                await act(() => {
                    fireEvent.click(getGuestAccessToggle(component)!);
                });

                expect(getErrorMessage(component)).toEqual("Failed to update the guest access of this space");
            });

            it("disables guest access toggle when setting guest access is not allowed", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                vi.mocked(space.currentState.maySendStateEvent).mockReturnValue(false);
                const component = getComponent({ space });

                await toggleGuestAccessSection(component);

                expect(getGuestAccessToggle(component)).toBeDisabled();
            });
        });

        describe("Preview", () => {
            it("renders preview space toggle", () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                const component = getComponent({ space });

                // toggle off because space settings is != WorldReadable
                expect(getHistoryVisibilityToggle(component)).not.toBeChecked();
            });

            it("updates history visibility on toggle", () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                const component = getComponent({ space });

                // toggle off because space settings is != WorldReadable
                expect(getHistoryVisibilityToggle(component)).not.toBeChecked();

                fireEvent.click(getHistoryVisibilityToggle(component)!);
                expect(mockMatrixClient.sendStateEvent).toHaveBeenCalledWith(
                    mockSpaceId,
                    EventType.RoomHistoryVisibility,
                    { history_visibility: HistoryVisibility.WorldReadable },
                    "",
                );

                expect(getHistoryVisibilityToggle(component)).toBeChecked();
            });

            it("renders error message when history update fails", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                vi.mocked(mockMatrixClient.sendStateEvent).mockRejectedValue({});
                const component = getComponent({ space });

                await act(() => {
                    fireEvent.click(getHistoryVisibilityToggle(component)!);
                });

                expect(getErrorMessage(component)).toEqual("Failed to update the history visibility of this space");
            });

            it("disables room preview toggle when history visibility changes are not allowed", () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                vi.mocked(space.currentState.maySendStateEvent).mockReturnValue(false);
                const component = getComponent({ space });
                expect(getHistoryVisibilityToggle(component)).toBeDisabled();
            });
        });

        it("renders addresses section with publish toggle", async () => {
            const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
            const { getByLabelText, getByTestId, asFragment } = getComponent({ space });

            expect(getByTestId("published-address-fieldset")).toBeTruthy();
            expect(getByTestId("local-address-fieldset")).toBeTruthy();
            // Wait for the async serverSupportsExploringSpaces / room directory visibility checks to resolve
            // and flow through React state updates (a few chained promises deep).
            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(0);
            expect(
                getByLabelText("Publish this room to the public in matrix.org's room directory?"),
            ).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
