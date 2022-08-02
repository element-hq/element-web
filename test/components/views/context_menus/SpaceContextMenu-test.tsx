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

import React from 'react';
// eslint-disable-next-line deprecate/import
import { mount } from 'enzyme';
import { Room } from 'matrix-js-sdk/src/matrix';
import { mocked } from 'jest-mock';
import { act } from 'react-dom/test-utils';
import 'focus-visible'; // to fix context menus

import SpaceContextMenu from '../../../../src/components/views/context_menus/SpaceContextMenu';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import { findByTestId } from '../../../test-utils';
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
    showSpaceSettings,
} from '../../../../src/utils/space';
import { leaveSpace } from "../../../../src/utils/leave-behaviour";
import { shouldShowComponent } from '../../../../src/customisations/helpers/UIComponents';
import { UIComponent } from '../../../../src/settings/UIFeature';

jest.mock('../../../../src/customisations/helpers/UIComponents', () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock('../../../../src/utils/space', () => ({
    shouldShowSpaceSettings: jest.fn(),
    showCreateNewRoom: jest.fn(),
    showCreateNewSubspace: jest.fn(),
    showSpaceInvite: jest.fn(),
    showSpacePreferences: jest.fn(),
    showSpaceSettings: jest.fn(),
}));

jest.mock('../../../../src/utils/leave-behaviour', () => ({
    leaveSpace: jest.fn(),
}));

describe('<SpaceContextMenu />', () => {
    const userId = '@test:server';
    const mockClient = {
        getUserId: jest.fn().mockReturnValue(userId),
    };
    const makeMockSpace = (props = {}) => ({
        name: 'test space',
        getJoinRule: jest.fn(),
        canInvite: jest.fn(),
        currentState: {
            maySendStateEvent: jest.fn(),
        },
        client: mockClient,
        getMyMembership: jest.fn(),
        ...props,
    }) as unknown as Room;
    const defaultProps = {
        space: makeMockSpace(),
        onFinished: jest.fn(),
    };
    const getComponent = (props = {}) =>
        mount(<SpaceContextMenu {...defaultProps} {...props} />,
            {
                wrappingComponent: MatrixClientContext.Provider,
                wrappingComponentProps: {
                    value: mockClient,
                },
            });

    beforeEach(() => {
        jest.resetAllMocks();
        mockClient.getUserId.mockReturnValue(userId);
    });

    it('renders menu correctly', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
    });

    it('renders invite option when space is public', () => {
        const space = makeMockSpace({
            getJoinRule: jest.fn().mockReturnValue('public'),
        });
        const component = getComponent({ space });
        expect(findByTestId(component, 'invite-option').length).toBeTruthy();
    });
    it('renders invite option when user is has invite rights for space', () => {
        const space = makeMockSpace({
            canInvite: jest.fn().mockReturnValue(true),
        });
        const component = getComponent({ space });
        expect(space.canInvite).toHaveBeenCalledWith(userId);
        expect(findByTestId(component, 'invite-option').length).toBeTruthy();
    });
    it('opens invite dialog when invite option is clicked', () => {
        const space = makeMockSpace({
            getJoinRule: jest.fn().mockReturnValue('public'),
        });
        const onFinished = jest.fn();
        const component = getComponent({ space, onFinished });

        act(() => {
            findByTestId(component, 'invite-option').at(0).simulate('click');
        });

        expect(showSpaceInvite).toHaveBeenCalledWith(space);
        expect(onFinished).toHaveBeenCalled();
    });
    it('renders space settings option when user has rights', () => {
        mocked(shouldShowSpaceSettings).mockReturnValue(true);
        const component = getComponent();
        expect(shouldShowSpaceSettings).toHaveBeenCalledWith(defaultProps.space);
        expect(findByTestId(component, 'settings-option').length).toBeTruthy();
    });
    it('opens space settings when space settings option is clicked', () => {
        mocked(shouldShowSpaceSettings).mockReturnValue(true);
        const onFinished = jest.fn();
        const component = getComponent({ onFinished });

        act(() => {
            findByTestId(component, 'settings-option').at(0).simulate('click');
        });

        expect(showSpaceSettings).toHaveBeenCalledWith(defaultProps.space);
        expect(onFinished).toHaveBeenCalled();
    });
    it('renders leave option when user does not have rights to see space settings', () => {
        const component = getComponent();
        expect(findByTestId(component, 'leave-option').length).toBeTruthy();
    });
    it('leaves space when leave option is clicked', () => {
        const onFinished = jest.fn();
        const component = getComponent({ onFinished });
        act(() => {
            findByTestId(component, 'leave-option').at(0).simulate('click');
        });
        expect(leaveSpace).toHaveBeenCalledWith(defaultProps.space);
        expect(onFinished).toHaveBeenCalled();
    });
    describe('add children section', () => {
        const space = makeMockSpace();
        beforeEach(() => {
            // set space to allow adding children to space
            mocked(space.currentState.maySendStateEvent).mockReturnValue(true);
            mocked(shouldShowComponent).mockReturnValue(true);
        });
        it('does not render section when user does not have permission to add children', () => {
            mocked(space.currentState.maySendStateEvent).mockReturnValue(false);
            const component = getComponent({ space });

            expect(findByTestId(component, 'add-to-space-header').length).toBeFalsy();
            expect(findByTestId(component, 'new-room-option').length).toBeFalsy();
            expect(findByTestId(component, 'new-subspace-option').length).toBeFalsy();
        });
        it('does not render section when UIComponent customisations disable room and space creation', () => {
            mocked(shouldShowComponent).mockReturnValue(false);
            const component = getComponent({ space });

            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.CreateRooms);
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.CreateSpaces);

            expect(findByTestId(component, 'add-to-space-header').length).toBeFalsy();
            expect(findByTestId(component, 'new-room-option').length).toBeFalsy();
            expect(findByTestId(component, 'new-subspace-option').length).toBeFalsy();
        });

        it('renders section with add room button when UIComponent customisation allows CreateRoom', () => {
            // only allow CreateRoom
            mocked(shouldShowComponent).mockImplementation(feature => feature === UIComponent.CreateRooms);
            const component = getComponent({ space });

            expect(findByTestId(component, 'add-to-space-header').length).toBeTruthy();
            expect(findByTestId(component, 'new-room-option').length).toBeTruthy();
            expect(findByTestId(component, 'new-subspace-option').length).toBeFalsy();
        });

        it('renders section with add space button when UIComponent customisation allows CreateSpace', () => {
            // only allow CreateSpaces
            mocked(shouldShowComponent).mockImplementation(feature => feature === UIComponent.CreateSpaces);
            const component = getComponent({ space });

            expect(findByTestId(component, 'add-to-space-header').length).toBeTruthy();
            expect(findByTestId(component, 'new-room-option').length).toBeFalsy();
            expect(findByTestId(component, 'new-subspace-option').length).toBeTruthy();
        });

        it('opens create room dialog on add room button click', () => {
            const onFinished = jest.fn();
            const component = getComponent({ space, onFinished });

            act(() => {
                findByTestId(component, 'new-room-option').at(0).simulate('click');
            });
            expect(showCreateNewRoom).toHaveBeenCalledWith(space);
            expect(onFinished).toHaveBeenCalled();
        });
        it('opens create space dialog on add space button click', () => {
            const onFinished = jest.fn();
            const component = getComponent({ space, onFinished });

            act(() => {
                findByTestId(component, 'new-subspace-option').at(0).simulate('click');
            });
            expect(showCreateNewSubspace).toHaveBeenCalledWith(space);
            expect(onFinished).toHaveBeenCalled();
        });
    });
});
