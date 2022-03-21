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
import { mount, ReactWrapper } from 'enzyme';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { mocked } from 'jest-mock';
import { act } from 'react-dom/test-utils';
import { M_BEACON_INFO } from 'matrix-js-sdk/src/@types/beacon';
import { M_ASSET, LocationAssetType } from 'matrix-js-sdk/src/@types/location';
import { logger } from 'matrix-js-sdk/src/logger';

import '../../../skinned-sdk';
import LocationShareMenu from '../../../../src/components/views/location/LocationShareMenu';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import { ChevronFace } from '../../../../src/components/structures/ContextMenu';
import SettingsStore from '../../../../src/settings/SettingsStore';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { LocationShareType } from '../../../../src/components/views/location/shareLocation';
import { findByTagAndTestId, flushPromises } from '../../../test-utils';
import Modal from '../../../../src/Modal';
import { DEFAULT_DURATION_MS } from '../../../../src/components/views/location/LiveDurationDropdown';

jest.mock('../../../../src/components/views/location/findMapStyleUrl', () => ({
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

jest.mock('../../../../src/Modal', () => ({
    createTrackedDialog: jest.fn(),
}));

describe('<LocationShareMenu />', () => {
    const userId = '@ernie:server.org';
    const mockClient = {
        on: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn(),
        getUserId: jest.fn().mockReturnValue(userId),
        getClientWellKnown: jest.fn().mockResolvedValue({
            map_style_url: 'maps.com',
        }),
        sendMessage: jest.fn(),
        unstable_createLiveBeacon: jest.fn().mockResolvedValue({}),
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

    const position = {
        coords: {
            latitude: -36.24484561954707,
            longitude: 175.46884959563613,
            accuracy: 10,
        },
        timestamp: 1646305006802,
        type: 'geolocate',
    };

    const getComponent = (props = {}) =>
        mount(<LocationShareMenu {...defaultProps} {...props} />, {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: mockClient },
        });

    beforeEach(() => {
        jest.spyOn(logger, 'error').mockRestore();
        mocked(SettingsStore).getValue.mockReturnValue(false);
        mockClient.sendMessage.mockClear();
        mockClient.unstable_createLiveBeacon.mockClear().mockResolvedValue(undefined);
        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient as unknown as MatrixClient);
        mocked(Modal).createTrackedDialog.mockClear();
    });

    const getShareTypeOption = (component: ReactWrapper, shareType: LocationShareType) =>
        findByTagAndTestId(component, `share-location-option-${shareType}`, 'button');

    const getBackButton = (component: ReactWrapper) =>
        findByTagAndTestId(component, 'share-dialog-buttons-back', 'button');

    const getCancelButton = (component: ReactWrapper) =>
        findByTagAndTestId(component, 'share-dialog-buttons-cancel', 'button');

    const getSubmitButton = (component: ReactWrapper) =>
        findByTagAndTestId(component, 'location-picker-submit-button', 'button');

    const setLocation = (component: ReactWrapper) => {
        // set the location
        const locationPickerInstance = component.find('LocationPicker').instance();
        act(() => {
            // @ts-ignore
            locationPickerInstance.onGeolocate(position);
            // make sure button gets enabled
            component.setProps({});
        });
    };

    const setShareType = (component: ReactWrapper, shareType: LocationShareType) =>
        act(() => {
            getShareTypeOption(component, shareType).at(0).simulate('click');
            component.setProps({});
        });

    describe('when only Own share type is enabled', () => {
        beforeEach(() => enableSettings([]));

        it('renders location picker when only Own share type is enabled', () => {
            const component = getComponent();
            expect(component.find('ShareType').length).toBe(0);
            expect(component.find('LocationPicker').length).toBe(1);
        });

        it('does not render back button when only Own share type is enabled', () => {
            const component = getComponent();
            expect(getBackButton(component).length).toBe(0);
        });

        it('clicking cancel button from location picker closes dialog', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            act(() => {
                getCancelButton(component).at(0).simulate('click');
            });

            expect(onFinished).toHaveBeenCalled();
        });

        it('creates static own location share event on submission', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            setLocation(component);

            act(() => {
                getSubmitButton(component).at(0).simulate('click');
                component.setProps({});
            });

            expect(onFinished).toHaveBeenCalled();
            const [messageRoomId, relation, messageBody] = mockClient.sendMessage.mock.calls[0];
            expect(messageRoomId).toEqual(defaultProps.roomId);
            expect(relation).toEqual(null);
            expect(messageBody).toEqual(expect.objectContaining({
                [M_ASSET.name]: {
                    type: LocationAssetType.Self,
                },
            }));
        });
    });

    describe('with pin drop share type enabled', () => {
        beforeEach(() => enableSettings(["feature_location_share_pin_drop"]));

        it('renders share type switch with own and pin drop options', () => {
            const component = getComponent();
            expect(component.find('LocationPicker').length).toBe(0);

            expect(getShareTypeOption(component, LocationShareType.Own).length).toBe(1);
            expect(getShareTypeOption(component, LocationShareType.Pin).length).toBe(1);
        });

        it('does not render back button on share type screen', () => {
            const component = getComponent();
            expect(getBackButton(component).length).toBe(0);
        });

        it('clicking cancel button from share type screen closes dialog', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            act(() => {
                getCancelButton(component).at(0).simulate('click');
            });

            expect(onFinished).toHaveBeenCalled();
        });

        it('selecting own location share type advances to location picker', () => {
            const component = getComponent();

            setShareType(component, LocationShareType.Own);

            expect(component.find('LocationPicker').length).toBe(1);
        });

        it('clicking back button from location picker screen goes back to share screen', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            // advance to location picker
            setShareType(component, LocationShareType.Own);

            expect(component.find('LocationPicker').length).toBe(1);

            act(() => {
                getBackButton(component).at(0).simulate('click');
                component.setProps({});
            });

            // back to share type
            expect(component.find('ShareType').length).toBe(1);
        });

        it('creates pin drop location share event on submission', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            // advance to location picker
            setShareType(component, LocationShareType.Pin);

            setLocation(component);

            act(() => {
                getSubmitButton(component).at(0).simulate('click');
                component.setProps({});
            });

            expect(onFinished).toHaveBeenCalled();
            const [messageRoomId, relation, messageBody] = mockClient.sendMessage.mock.calls[0];
            expect(messageRoomId).toEqual(defaultProps.roomId);
            expect(relation).toEqual(null);
            expect(messageBody).toEqual(expect.objectContaining({
                [M_ASSET.name]: {
                    type: LocationAssetType.Pin,
                },
            }));
        });
    });

    describe('with live location and pin drop enabled', () => {
        beforeEach(() => enableSettings([
            "feature_location_share_pin_drop",
            "feature_location_share_live",
        ]));

        it('renders share type switch with all 3 options', () => {
            // Given pin and live feature flags are enabled
            // When I click Location
            const component = getComponent();

            // The the Location picker is not visible yet
            expect(component.find('LocationPicker').length).toBe(0);

            // And all 3 buttons are visible on the LocationShare dialog
            expect(
                getShareTypeOption(component, LocationShareType.Own).length,
            ).toBe(1);

            expect(
                getShareTypeOption(component, LocationShareType.Pin).length,
            ).toBe(1);

            const liveButton = getShareTypeOption(component, LocationShareType.Live);
            expect(liveButton.length).toBe(1);

            // The live location button is enabled
            expect(liveButton.hasClass("mx_AccessibleButton_disabled")).toBeFalsy();
        });
    });

    describe('Live location share', () => {
        beforeEach(() => enableSettings(["feature_location_share_live"]));

        it('creates beacon info event on submission', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            // advance to location picker
            setShareType(component, LocationShareType.Live);
            setLocation(component);

            act(() => {
                getSubmitButton(component).at(0).simulate('click');
                component.setProps({});
            });

            expect(onFinished).toHaveBeenCalled();
            const [eventRoomId, eventContent, eventTypeSuffix] = mockClient.unstable_createLiveBeacon.mock.calls[0];
            expect(eventRoomId).toEqual(defaultProps.roomId);
            expect(eventTypeSuffix).toBeTruthy();
            expect(eventContent).toEqual(expect.objectContaining({
                [M_BEACON_INFO.name]: {
                    // default timeout
                    timeout: DEFAULT_DURATION_MS,
                    description: `Ernie's live location`,
                    live: true,
                },
                [M_ASSET.name]: {
                    type: LocationAssetType.Self,
                },
            }));
        });

        it('opens error dialog when beacon creation fails ', async () => {
            // stub logger to keep console clean from expected error
            const logSpy = jest.spyOn(logger, 'error').mockReturnValue(undefined);
            const error = new Error('oh no');
            mockClient.unstable_createLiveBeacon.mockRejectedValue(error);
            const component = getComponent();

            // advance to location picker
            setShareType(component, LocationShareType.Live);
            setLocation(component);

            act(() => {
                getSubmitButton(component).at(0).simulate('click');
                component.setProps({});
            });

            await flushPromises();

            expect(logSpy).toHaveBeenCalledWith("We couldn't start sharing your live location", error);
            expect(mocked(Modal).createTrackedDialog).toHaveBeenCalled();
        });
    });
});

function enableSettings(settings: string[]) {
    mocked(SettingsStore).getValue.mockReturnValue(false);
    mocked(SettingsStore).getValue.mockImplementation(
        (settingName: string) => settings.includes(settingName),
    );
}
