/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { act, fireEvent, render, type RenderResult } from "jest-matrix-react";
import {
    EventType,
    type MatrixClient,
    type Room,
    GuestAccess,
    HistoryVisibility,
    JoinRule,
} from "matrix-js-sdk/src/matrix";

import _SpaceSettingsVisibilityTab from "../../../../../src/components/views/spaces/SpaceSettingsVisibilityTab";
import {
    createTestClient,
    mkEvent,
    wrapInMatrixClientContext,
    mkSpace,
    mockStateEventImplementation,
} from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

const SpaceSettingsVisibilityTab = wrapInMatrixClientContext(_SpaceSettingsVisibilityTab);

jest.useFakeTimers();

describe("<SpaceSettingsVisibilityTab />", () => {
    const mockMatrixClient = createTestClient() as MatrixClient;

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
        const getStateEvents = mockStateEventImplementation(events);
        mocked(space.currentState).getStateEvents.mockImplementation(getStateEvents);
        mocked(space.currentState).mayClientSendStateEvent.mockReturnValue(false);
        space.getJoinRule.mockReturnValue(joinRule);
        mocked(space.currentState).getJoinRule.mockReturnValue(joinRule);
        return space as unknown as Room;
    };
    const defaultProps = {
        matrixClient: mockMatrixClient,
        space: makeMockSpace(mockMatrixClient),
        closeSettingsFn: jest.fn(),
    };

    const getComponent = (props = {}) => {
        return render(<SpaceSettingsVisibilityTab {...defaultProps} {...props} />);
    };

    const toggleGuestAccessSection = async ({ getByTestId }: RenderResult) => {
        const toggleButton = getByTestId("toggle-guest-access-btn")!;
        fireEvent.click(toggleButton);
    };
    const getGuestAccessToggle = ({ getByLabelText }: RenderResult) => getByLabelText("Enable guest access");
    const getHistoryVisibilityToggle = ({ getByLabelText }: RenderResult) => getByLabelText("Preview Space");
    const getErrorMessage = ({ getByTestId }: RenderResult) => getByTestId("space-settings-error")?.textContent;

    beforeEach(() => {
        let i = 0;
        mocked(secureRandomString).mockImplementation(() => {
            return "testid_" + i++;
        });

        (mockMatrixClient.sendStateEvent as jest.Mock).mockClear().mockResolvedValue({});
        MatrixClientPeg.get = jest.fn().mockReturnValue(mockMatrixClient);
        MatrixClientPeg.safeGet = jest.fn().mockReturnValue(mockMatrixClient);
    });

    afterEach(() => {
        jest.runAllTimers();
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

                expect(guestAccessInput?.getAttribute("aria-checked")).toEqual("true");

                fireEvent.click(guestAccessInput!);
                expect(mockMatrixClient.sendStateEvent).toHaveBeenCalledWith(
                    mockSpaceId,
                    EventType.RoomGuestAccess,
                    // toggled off
                    { guest_access: GuestAccess.Forbidden },
                    "",
                );

                // toggled off
                expect(guestAccessInput?.getAttribute("aria-checked")).toEqual("false");
            });

            it("renders error message when update fails", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                (mockMatrixClient.sendStateEvent as jest.Mock).mockRejectedValue({});
                const component = getComponent({ space });
                await toggleGuestAccessSection(component);
                await act(() => {
                    fireEvent.click(getGuestAccessToggle(component)!);
                });

                expect(getErrorMessage(component)).toEqual("Failed to update the guest access of this space");
            });

            it("disables guest access toggle when setting guest access is not allowed", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                (space.currentState.maySendStateEvent as jest.Mock).mockReturnValue(false);
                const component = getComponent({ space });

                await toggleGuestAccessSection(component);

                expect(getGuestAccessToggle(component)?.getAttribute("aria-disabled")).toEqual("true");
            });
        });

        describe("Preview", () => {
            it("renders preview space toggle", () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                const component = getComponent({ space });

                // toggle off because space settings is != WorldReadable
                expect(getHistoryVisibilityToggle(component)?.getAttribute("aria-checked")).toEqual("false");
            });

            it("updates history visibility on toggle", () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                const component = getComponent({ space });

                // toggle off because space settings is != WorldReadable
                expect(getHistoryVisibilityToggle(component)?.getAttribute("aria-checked")).toEqual("false");

                fireEvent.click(getHistoryVisibilityToggle(component)!);
                expect(mockMatrixClient.sendStateEvent).toHaveBeenCalledWith(
                    mockSpaceId,
                    EventType.RoomHistoryVisibility,
                    { history_visibility: HistoryVisibility.WorldReadable },
                    "",
                );

                expect(getHistoryVisibilityToggle(component)?.getAttribute("aria-checked")).toEqual("true");
            });

            it("renders error message when history update fails", async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                (mockMatrixClient.sendStateEvent as jest.Mock).mockRejectedValue({});
                const component = getComponent({ space });

                await act(() => {
                    fireEvent.click(getHistoryVisibilityToggle(component)!);
                });

                expect(getErrorMessage(component)).toEqual("Failed to update the history visibility of this space");
            });

            it("disables room preview toggle when history visibility changes are not allowed", () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                (space.currentState.maySendStateEvent as jest.Mock).mockReturnValue(false);
                const component = getComponent({ space });
                expect(getHistoryVisibilityToggle(component)?.getAttribute("aria-disabled")).toEqual("true");
            });
        });

        it("renders addresses section", () => {
            const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
            const { getByTestId } = getComponent({ space });

            expect(getByTestId("published-address-fieldset")).toBeTruthy();
            expect(getByTestId("local-address-fieldset")).toBeTruthy();
        });
    });
});
