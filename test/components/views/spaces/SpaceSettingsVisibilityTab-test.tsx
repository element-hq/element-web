// skinned-sdk should be the first import in most tests
import '../../../skinned-sdk';
import React from "react";
import {
    renderIntoDocument,
    Simulate,
} from 'react-dom/test-utils';
import { act } from "react-dom/test-utils";
import { EventType, MatrixClient, Room } from 'matrix-js-sdk';
import { GuestAccess, HistoryVisibility, JoinRule } from 'matrix-js-sdk/src/@types/partials';

import _SpaceSettingsVisibilityTab from "../../../../src/components/views/spaces/SpaceSettingsVisibilityTab";
import { createTestClient, mkEvent, wrapInMatrixClientContext } from '../../../test-utils';
import { mkSpace, mockStateEventImplementation } from '../../../utils/test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';

const SpaceSettingsVisibilityTab = wrapInMatrixClientContext(_SpaceSettingsVisibilityTab);

jest.useFakeTimers();

describe('<SpaceSettingsVisibilityTab />', () => {
    const mockMatrixClient = createTestClient() as MatrixClient;

    const makeJoinEvent = (rule: JoinRule = JoinRule.Invite) => mkEvent({
        type: EventType.RoomJoinRules, event: true, content: {
            join_rule: rule,
        },
    } as any);
    const makeGuestAccessEvent = (rule: GuestAccess = GuestAccess.CanJoin) => mkEvent({
        type: EventType.RoomGuestAccess, event: true, content: {
            guest_access: rule,
        },
    } as any);
    const makeHistoryEvent = (rule: HistoryVisibility = HistoryVisibility.Shared) => mkEvent({
        type: EventType.RoomHistoryVisibility, event: true, content: {
            history_visibility: rule,
        },
    } as any);

    const mockSpaceId = 'mock-space';

    // TODO case for canonical
    const makeMockSpace = (
        client: MatrixClient,
        joinRule: JoinRule = JoinRule.Invite,
        guestRule: GuestAccess = GuestAccess.CanJoin,
        historyRule: HistoryVisibility = HistoryVisibility.WorldReadable,
    ): Room => {
        const events = [
            makeJoinEvent(joinRule),
            makeGuestAccessEvent(guestRule),
            makeHistoryEvent(historyRule),
        ];
        const space = mkSpace(client, mockSpaceId);
        const getStateEvents = mockStateEventImplementation(events);
        space.currentState.getStateEvents.mockImplementation(getStateEvents);
        space.currentState.mayClientSendStateEvent.mockReturnValue(false);
        const mockGetJoinRule = jest.fn().mockReturnValue(joinRule);
        space.getJoinRule = mockGetJoinRule;
        space.currentState.getJoinRule = mockGetJoinRule;
        return space as unknown as Room;
    };
    const defaultProps = {
        matrixClient: mockMatrixClient,
        space: makeMockSpace(mockMatrixClient),
        closeSettingsFn: jest.fn(),
    };

    const getComponent = (props = {}) => {
        const wrapper = renderIntoDocument<HTMLSpanElement>(
            // wrap in element so renderIntoDocument can render functional component
            <span>
                <SpaceSettingsVisibilityTab {...defaultProps} {...props} />
            </span>,
        ) as HTMLSpanElement;
        return wrapper.children[0];
    };

    const getByTestId = (container: Element, id: string) => container.querySelector(`[data-test-id=${id}]`);
    const toggleGuestAccessSection = async (component) => {
        const toggleButton = getByTestId(component, 'toggle-guest-access-btn');
        await act(async () => {
            Simulate.click(toggleButton);
        });
    };
    const getGuestAccessToggle = component => component.querySelector('[aria-label="Enable guest access"');
    const getHistoryVisibilityToggle = component => component.querySelector('[aria-label="Preview Space"');
    const getErrorMessage = component => getByTestId(component, 'space-settings-error')?.textContent;

    beforeEach(() => {
        (mockMatrixClient.sendStateEvent as jest.Mock).mockClear().mockResolvedValue({});
        MatrixClientPeg.get = jest.fn().mockReturnValue(mockMatrixClient);
    });

    afterEach(() => {
        jest.runAllTimers();
    });

    it('renders container', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
    });

    describe('for a private space', () => {
        const joinRule = JoinRule.Invite;
        it('does not render addresses section', () => {
            const space = makeMockSpace(mockMatrixClient, joinRule);
            const component = getComponent({ space });

            expect(getByTestId(component, 'published-address-fieldset')).toBeFalsy();
            expect(getByTestId(component, 'local-address-fieldset')).toBeFalsy();
        });
    });

    describe('for a public space', () => {
        const joinRule = JoinRule.Public;
        const guestRule = GuestAccess.CanJoin;
        const historyRule = HistoryVisibility.Joined;

        describe('Access', () => {
            it('renders guest access section toggle', async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                const component = getComponent({ space });

                await toggleGuestAccessSection(component);

                expect(getGuestAccessToggle(component)).toMatchSnapshot();
            });

            it('send guest access event on toggle', async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);

                const component = getComponent({ space });
                await toggleGuestAccessSection(component);
                const guestAccessInput = getGuestAccessToggle(component);

                expect(guestAccessInput.getAttribute('aria-checked')).toEqual("true");

                await act(async () => {
                    Simulate.click(guestAccessInput);
                });

                expect(mockMatrixClient.sendStateEvent).toHaveBeenCalledWith(
                    mockSpaceId,
                    EventType.RoomGuestAccess,
                    // toggled off
                    { guest_access: GuestAccess.Forbidden },
                    "",
                );

                // toggled off
                expect(guestAccessInput.getAttribute('aria-checked')).toEqual("false");
            });

            it('renders error message when update fails', async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                (mockMatrixClient.sendStateEvent as jest.Mock).mockRejectedValue({});
                const component = getComponent({ space });
                await toggleGuestAccessSection(component);
                await act(async () => {
                    Simulate.click(getGuestAccessToggle(component));
                });

                expect(getErrorMessage(component)).toEqual("Failed to update the guest access of this space");
            });

            it('disables guest access toggle when setting guest access is not allowed', async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
                (space.currentState.maySendStateEvent as jest.Mock).mockReturnValue(false);
                const component = getComponent({ space });

                await toggleGuestAccessSection(component);

                expect(getGuestAccessToggle(component).getAttribute('aria-disabled')).toEqual("true");
            });
        });

        describe('Preview', () => {
            it('renders preview space toggle', () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                const component = getComponent({ space });

                // toggle off because space settings is != WorldReadable
                expect(getHistoryVisibilityToggle(component).getAttribute('aria-checked')).toEqual("false");
            });

            it('updates history visibility on toggle', async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                const component = getComponent({ space });

                // toggle off because space settings is != WorldReadable
                expect(getHistoryVisibilityToggle(component).getAttribute('aria-checked')).toEqual("false");

                await act(async () => {
                    Simulate.click(getHistoryVisibilityToggle(component));
                });

                expect(mockMatrixClient.sendStateEvent).toHaveBeenCalledWith(
                    mockSpaceId,
                    EventType.RoomHistoryVisibility,
                    { history_visibility: HistoryVisibility.WorldReadable },
                    "",
                );

                expect(getHistoryVisibilityToggle(component).getAttribute('aria-checked')).toEqual("true");
            });

            it('renders error message when history update fails', async () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                (mockMatrixClient.sendStateEvent as jest.Mock).mockRejectedValue({});
                const component = getComponent({ space });

                await act(async () => {
                    Simulate.click(getHistoryVisibilityToggle(component));
                });

                expect(getErrorMessage(component)).toEqual("Failed to update the history visibility of this space");
            });

            it('disables room preview toggle when history visability changes are not allowed', () => {
                const space = makeMockSpace(mockMatrixClient, joinRule, guestRule, historyRule);
                (space.currentState.maySendStateEvent as jest.Mock).mockReturnValue(false);
                const component = getComponent({ space });
                expect(getHistoryVisibilityToggle(component).getAttribute('aria-disabled')).toEqual("true");
            });
        });

        it('renders addresses section', () => {
            const space = makeMockSpace(mockMatrixClient, joinRule, guestRule);
            const component = getComponent({ space });

            expect(getByTestId(component, 'published-address-fieldset')).toBeTruthy();
            expect(getByTestId(component, 'local-address-fieldset')).toBeTruthy();
        });
    });
});
