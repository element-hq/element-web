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
import { mocked } from 'jest-mock';
import { act } from "react-dom/test-utils";
import { Room, User, MatrixClient } from 'matrix-js-sdk/src/matrix';
import { Phase, VerificationRequest } from 'matrix-js-sdk/src/crypto/verification/request/VerificationRequest';

import UserInfo from '../../../../src/components/views/right_panel/UserInfo';
import { RightPanelPhases } from '../../../../src/stores/right-panel/RightPanelStorePhases';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import VerificationPanel from '../../../../src/components/views/right_panel/VerificationPanel';
import EncryptionInfo from '../../../../src/components/views/right_panel/EncryptionInfo';

const findByTestId = (component, id) => component.find(`[data-test-id="${id}"]`);

jest.mock('../../../../src/utils/DMRoomMap', () => {
    const mock = {
        getUserIdForRoomId: jest.fn(),
        getDMRoomsForUserId: jest.fn(),
    };

    return {
        shared: jest.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});

describe('<UserInfo />', () => {
    const defaultUserId = '@test:test';
    const defaultUser = new User(defaultUserId);

    const mockClient = mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        isCryptoEnabled: jest.fn(),
        getUserId: jest.fn(),
        on: jest.fn(),
        isSynapseAdministrator: jest.fn().mockResolvedValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        doesServerSupportUnstableFeature: jest.fn().mockReturnValue(false),
        mxcUrlToHttp: jest.fn().mockReturnValue('mock-mxcUrlToHttp'),
        removeListener: jest.fn(),
        currentState: {
            on: jest.fn(),
        },
    } as unknown as MatrixClient);

    const verificationRequest = {
        pending: true, on: jest.fn(), phase: Phase.Ready,
        channel: { transactionId: 1 },
        otherPartySupportsMethod: jest.fn(),
    } as unknown as VerificationRequest;

    const defaultProps = {
        user: defaultUser,
        // idk what is wrong with this type
        phase: RightPanelPhases.RoomMemberInfo as RightPanelPhases.RoomMemberInfo,
        onClose: jest.fn(),
    };

    const getComponent = (props = {}) => mount(
        <UserInfo {...defaultProps} {...props} />,
        {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: mockClient },
        },
    );

    beforeAll(() => {
        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient);
    });

    beforeEach(() => {
        mockClient.getUser.mockClear().mockReturnValue({} as unknown as User);
    });

    it('closes on close button click', () => {
        const onClose = jest.fn();
        const component = getComponent({ onClose });
        act(() => {
            findByTestId(component, 'base-card-close-button').at(0).simulate('click');
        });

        expect(onClose).toHaveBeenCalled();
    });

    describe('without a room', () => {
        it('does not render space header', () => {
            const component = getComponent();
            expect(findByTestId(component, 'space-header').length).toBeFalsy();
        });

        it('renders user info', () => {
            const component = getComponent();
            expect(component.find("BasicUserInfo").length).toBeTruthy();
        });

        it('renders encryption info panel without pending verification', () => {
            const phase = RightPanelPhases.EncryptionPanel;
            const component = getComponent({ phase });

            expect(component.find(EncryptionInfo).length).toBeTruthy();
        });

        it('renders encryption verification panel with pending verification', () => {
            const phase = RightPanelPhases.EncryptionPanel;
            const component = getComponent({ phase, verificationRequest });

            expect(component.find(EncryptionInfo).length).toBeFalsy();
            expect(component.find(VerificationPanel).length).toBeTruthy();
        });

        it('renders close button correctly when encryption panel with a pending verification request', () => {
            const phase = RightPanelPhases.EncryptionPanel;
            const component = getComponent({ phase, verificationRequest });

            expect(findByTestId(component, 'base-card-close-button').at(0).props().title).toEqual('Cancel');
        });
    });

    describe('with a room', () => {
        const room = {
            roomId: '!fkfk',
            isSpaceRoom: jest.fn().mockReturnValue(false),
            getMember: jest.fn().mockReturnValue(undefined),
            getMxcAvatarUrl: jest.fn().mockReturnValue('mock-avatar-url'),
            name: 'test room',
            on: jest.fn(),
            currentState: {
                getStateEvents: jest.fn(),
                on: jest.fn(),
            },
        } as unknown as Room;

        it('renders user info', () => {
            const component = getComponent();
            expect(component.find("BasicUserInfo").length).toBeTruthy();
        });

        it('does not render space header when room is not a space room', () => {
            const component = getComponent({ room });
            expect(findByTestId(component, 'space-header').length).toBeFalsy();
        });

        it('renders space header when room is a space room', () => {
            const spaceRoom = {
                ...room, isSpaceRoom: jest.fn().mockReturnValue(true),
            };
            const component = getComponent({ room: spaceRoom });
            expect(findByTestId(component, 'space-header').length).toBeTruthy();
        });

        it('renders encryption info panel without pending verification', () => {
            const phase = RightPanelPhases.EncryptionPanel;
            const component = getComponent({ phase, room });

            expect(component.find(EncryptionInfo).length).toBeTruthy();
        });

        it('renders encryption verification panel with pending verification', () => {
            const phase = RightPanelPhases.EncryptionPanel;
            const component = getComponent({ phase, verificationRequest, room });

            expect(component.find(EncryptionInfo).length).toBeFalsy();
            expect(component.find(VerificationPanel).length).toBeTruthy();
        });
    });
});
