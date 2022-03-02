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
import { mount } from 'enzyme';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { mocked } from 'jest-mock';
import { act } from 'react-dom/test-utils';

import '../../../skinned-sdk';
import LocationShareMenu from '../../../../src/components/views/location/LocationShareMenu';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import { ChevronFace } from '../../../../src/components/structures/ContextMenu';
import SettingsStore from '../../../../src/settings/SettingsStore';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { LocationShareType } from '../../../../src/components/views/location/ShareType';
import { findByTestId } from '../../../test-utils';

jest.mock('../../../../src/components/views/messages/MLocationBody', () => ({
    findMapStyleUrl: jest.fn().mockReturnValue('test'),
}));

jest.mock('../../../../src/settings/SettingsStore', () => ({
    getValue: jest.fn(),
    monitorSetting: jest.fn(),
}));

jest.mock('../../../../src/stores/OwnProfileStore', () => ({
    OwnProfileStore: {
        instance: {
            displayName: 'Ernie',
            getHttpAvatarUrl: jest.fn().mockReturnValue('image.com/img'),
        },
    },
}));

describe('<LocationShareMenu />', () => {
    const userId = '@ernie:server.org';
    const mockClient = {
        on: jest.fn(),
        removeListener: jest.fn(),
        getUserId: jest.fn().mockReturnValue(userId),
        getClientWellKnown: jest.fn().mockResolvedValue({
            map_style_url: 'maps.com',
        }),
    };

    const defaultProps = {
        menuPosition: {
            top: 1, left: 1,
            chevronFace: ChevronFace.Bottom,
        },
        onFinished: jest.fn(),
        openMenu: jest.fn(),
        roomId: '!room:server.org',
        sender: new RoomMember('!room:server.org', userId),
    };
    const getComponent = (props = {}) =>
        mount(<LocationShareMenu {...defaultProps} {...props} />, {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: mockClient },
        });

    beforeEach(() => {
        mocked(SettingsStore).getValue.mockImplementation(
            (settingName) => settingName === "feature_location_share_pin_drop",
        );

        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient as unknown as MatrixClient);
    });

    const getShareTypeOption = (component, shareType: LocationShareType) =>
        findByTestId(component, `share-location-option-${shareType}`);

    it('renders location picker when only Own share type is enabled', () => {
        mocked(SettingsStore).getValue.mockReturnValue(false);
        const component = getComponent();
        expect(component.find('ShareType').length).toBeFalsy();
        expect(component.find('LocationPicker').length).toBeTruthy();
    });

    it('renders share type switch with own and pin drop options when enabled', () => {
        // feature_location_share_pin_drop is set to enabled by default mocking
        const component = getComponent();
        expect(component.find('LocationPicker').length).toBeFalsy();

        expect(getShareTypeOption(component, LocationShareType.Own).length).toBeTruthy();
        expect(getShareTypeOption(component, LocationShareType.Pin).length).toBeTruthy();
    });

    it('selecting own location share type advances to location picker', () => {
        // feature_location_share_pin_drop is set to enabled by default mocking
        const component = getComponent();

        act(() => {
            getShareTypeOption(component, LocationShareType.Own).at(0).simulate('click');
        });

        component.setProps({});

        expect(component.find('LocationPicker').length).toBeTruthy();
    });
});
