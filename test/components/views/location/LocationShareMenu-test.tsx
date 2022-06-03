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
import { mocked } from 'jest-mock';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { RelationType } from 'matrix-js-sdk/src/matrix';
import { logger } from 'matrix-js-sdk/src/logger';
import { M_ASSET, LocationAssetType } from 'matrix-js-sdk/src/@types/location';
import { act } from 'react-dom/test-utils';

import LocationShareMenu from '../../../../src/components/views/location/LocationShareMenu';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import { ChevronFace } from '../../../../src/components/structures/ContextMenu';
import SettingsStore from '../../../../src/settings/SettingsStore';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { LocationShareType } from '../../../../src/components/views/location/shareLocation';
import {
    findByTagAndTestId,
    findByTestId,
    flushPromisesWithFakeTimers,
    getMockClientWithEventEmitter,
    setupAsyncStoreWithClient,
} from '../../../test-utils';
import Modal from '../../../../src/Modal';
import { DEFAULT_DURATION_MS } from '../../../../src/components/views/location/LiveDurationDropdown';
import { OwnBeaconStore } from '../../../../src/stores/OwnBeaconStore';
import { SettingLevel } from '../../../../src/settings/SettingLevel';

jest.useFakeTimers();

jest.mock('../../../../src/utils/location/findMapStyleUrl', () => ({
    findMapStyleUrl: jest.fn().mockReturnValue('test'),
}));

jest.mock('../../../../src/settings/SettingsStore', () => ({
    getValue: jest.fn(),
    setValue: jest.fn(),
    monitorSetting: jest.fn(),
    watchSetting: jest.fn(),
    unwatchSetting: jest.fn(),
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
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(userId),
        getClientWellKnown: jest.fn().mockResolvedValue({
            map_style_url: 'maps.com',
        }),
        sendMessage: jest.fn(),
        unstable_createLiveBeacon: jest.fn().mockResolvedValue({ event_id: '1' }),
        getVisibleRooms: jest.fn().mockReturnValue([]),
    });

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

    const makeOwnBeaconStore = async () => {
        const store = OwnBeaconStore.instance;

        await setupAsyncStoreWithClient(store, mockClient);
        return store;
    };

    const getComponent = (props = {}) =>
        mount(<LocationShareMenu {...defaultProps} {...props} />, {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: mockClient },
        });

    beforeEach(async () => {
        jest.spyOn(logger, 'error').mockRestore();
        mocked(SettingsStore).getValue.mockReturnValue(false);
        mockClient.sendMessage.mockClear();
        mockClient.unstable_createLiveBeacon.mockClear().mockResolvedValue({ event_id: '1' });
        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient as unknown as MatrixClient);
        mocked(Modal).createTrackedDialog.mockClear();

        jest.clearAllMocks();

        await makeOwnBeaconStore();
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

        it('renders own and live location options', () => {
            const component = getComponent();
            expect(getShareTypeOption(component, LocationShareType.Own).length).toBe(1);
            expect(getShareTypeOption(component, LocationShareType.Live).length).toBe(1);
        });

        it('renders back button from location picker screen', () => {
            const component = getComponent();
            setShareType(component, LocationShareType.Own);

            expect(getBackButton(component).length).toBe(1);
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

            setShareType(component, LocationShareType.Own);

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

    describe('with live location disabled', () => {
        beforeEach(() => enableSettings([]));

        const getToggle = (component: ReactWrapper) =>
            findByTestId(component, 'enable-live-share-toggle').find('[role="switch"]').at(0);
        const getSubmitEnableButton = (component: ReactWrapper) =>
            findByTestId(component, 'enable-live-share-submit').at(0);

        it('goes to labs flag screen after live options is clicked', () => {
            const onFinished = jest.fn();
            const component = getComponent({ onFinished });

            setShareType(component, LocationShareType.Live);

            expect(findByTestId(component, 'location-picker-enable-live-share')).toMatchSnapshot();
        });

        it('disables OK button when labs flag is not enabled', () => {
            const component = getComponent();

            setShareType(component, LocationShareType.Live);

            expect(getSubmitEnableButton(component).props()['disabled']).toBeTruthy();
        });

        it('enables OK button when labs flag is toggled to enabled', () => {
            const component = getComponent();

            setShareType(component, LocationShareType.Live);

            act(() => {
                getToggle(component).simulate('click');
                component.setProps({});
            });
            expect(getSubmitEnableButton(component).props()['disabled']).toBeFalsy();
        });

        it('enables live share setting on ok button submit', () => {
            const component = getComponent();

            setShareType(component, LocationShareType.Live);

            act(() => {
                getToggle(component).simulate('click');
                component.setProps({});
            });

            act(() => {
                getSubmitEnableButton(component).simulate('click');
            });

            expect(SettingsStore.setValue).toHaveBeenCalledWith(
                'feature_location_share_live', undefined, SettingLevel.DEVICE, true,
            );
        });

        it('navigates to location picker when live share is enabled in settings store', () => {
            // @ts-ignore
            mocked(SettingsStore.watchSetting).mockImplementation((featureName, roomId, callback) => {
                callback(featureName, roomId, SettingLevel.DEVICE, '', '');
                setTimeout(() => {
                    callback(featureName, roomId, SettingLevel.DEVICE, '', '');
                }, 1000);
            });
            mocked(SettingsStore.getValue).mockReturnValue(false);
            const component = getComponent();

            setShareType(component, LocationShareType.Live);

            // we're on enable live share screen
            expect(findByTestId(component, 'location-picker-enable-live-share').length).toBeTruthy();

            act(() => {
                mocked(SettingsStore.getValue).mockReturnValue(true);
                // advance so watchSetting will update the value
                jest.runAllTimers();
            });

            component.setProps({});

            // advanced to location picker
            expect(component.find('LocationPicker').length).toBeTruthy();
        });
    });

    describe('Live location share', () => {
        beforeEach(() => enableSettings(["feature_location_share_live"]));

        it('does not display live location share option when composer has a relation', () => {
            const relation = {
                rel_type: RelationType.Thread,
                event_id: '12345',
            };
            const component = getComponent({ relation });

            expect(getShareTypeOption(component, LocationShareType.Live).length).toBeFalsy();
        });

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
            const [eventRoomId, eventContent] = mockClient.unstable_createLiveBeacon.mock.calls[0];
            expect(eventRoomId).toEqual(defaultProps.roomId);
            expect(eventContent).toEqual(expect.objectContaining({
                // default timeout
                timeout: DEFAULT_DURATION_MS,
                description: `Ernie's live location`,
                live: true,
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

            await flushPromisesWithFakeTimers();
            await flushPromisesWithFakeTimers();

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
