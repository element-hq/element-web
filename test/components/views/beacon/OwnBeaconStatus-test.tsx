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
import { act } from 'react-dom/test-utils';
import { mocked } from 'jest-mock';
import { Beacon } from 'matrix-js-sdk/src/matrix';

import OwnBeaconStatus from '../../../../src/components/views/beacon/OwnBeaconStatus';
import { BeaconDisplayStatus } from '../../../../src/components/views/beacon/displayStatus';
import { useOwnLiveBeacons } from '../../../../src/utils/beacon';
import { findByTestId, makeBeaconInfoEvent } from '../../../test-utils';

jest.mock('../../../../src/utils/beacon/useOwnLiveBeacons', () => ({
    useOwnLiveBeacons: jest.fn(),
}));

describe('<OwnBeaconStatus />', () => {
    const defaultProps = {
        displayStatus: BeaconDisplayStatus.Loading,
    };
    const userId = '@user:server';
    const roomId = '!room:server';
    let defaultBeacon;
    const getComponent = (props = {}) =>
        mount(<OwnBeaconStatus {...defaultProps} {...props} />);

    beforeEach(() => {
        jest.spyOn(global.Date, 'now').mockReturnValue(123456789);
        mocked(useOwnLiveBeacons).mockClear().mockReturnValue({});

        defaultBeacon = new Beacon(makeBeaconInfoEvent(userId, roomId));
    });

    it('renders without a beacon instance', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
    });

    it('renders loading state correctly', () => {
        const component = getComponent();
        expect(component.find('BeaconStatus').props()).toBeTruthy();
    });

    describe('Active state', () => {
        it('renders stop button', () => {
            const displayStatus = BeaconDisplayStatus.Active;
            mocked(useOwnLiveBeacons).mockReturnValue({
                onStopSharing: jest.fn(),
            });
            const component = getComponent({ displayStatus, beacon: defaultBeacon });
            expect(component.text()).toContain('Live location enabled');

            expect(findByTestId(component, 'beacon-status-stop-beacon').length).toBeTruthy();
        });

        it('stops sharing on stop button click', () => {
            const displayStatus = BeaconDisplayStatus.Active;
            const onStopSharing = jest.fn();
            mocked(useOwnLiveBeacons).mockReturnValue({
                onStopSharing,
            });
            const component = getComponent({ displayStatus, beacon: defaultBeacon });

            act(() => {
                findByTestId(component, 'beacon-status-stop-beacon').at(0).simulate('click');
            });

            expect(onStopSharing).toHaveBeenCalled();
        });
    });

    describe('errors', () => {
        it('renders in error mode when displayStatus is error', () => {
            const displayStatus = BeaconDisplayStatus.Error;
            const component = getComponent({ displayStatus });
            expect(component.text()).toEqual('Live location error');

            // no actions for plain error
            expect(component.find('AccessibleButton').length).toBeFalsy();
        });

        describe('with location publish error', () => {
            it('renders in error mode', () => {
                const displayStatus = BeaconDisplayStatus.Active;
                mocked(useOwnLiveBeacons).mockReturnValue({
                    hasLocationPublishError: true,
                    onResetLocationPublishError: jest.fn(),
                });
                const component = getComponent({ displayStatus, beacon: defaultBeacon });
                expect(component.text()).toContain('Live location error');
                // retry button
                expect(findByTestId(component, 'beacon-status-reset-wire-error').length).toBeTruthy();
            });

            it('retry button resets location publish error', () => {
                const displayStatus = BeaconDisplayStatus.Active;
                const onResetLocationPublishError = jest.fn();
                mocked(useOwnLiveBeacons).mockReturnValue({
                    hasLocationPublishError: true,
                    onResetLocationPublishError,
                });
                const component = getComponent({ displayStatus, beacon: defaultBeacon });
                act(() => {
                    findByTestId(component, 'beacon-status-reset-wire-error').at(0).simulate('click');
                });

                expect(onResetLocationPublishError).toHaveBeenCalled();
            });
        });

        describe('with stopping error', () => {
            it('renders in error mode', () => {
                const displayStatus = BeaconDisplayStatus.Active;
                mocked(useOwnLiveBeacons).mockReturnValue({
                    hasLocationPublishError: false,
                    hasStopSharingError: true,
                    onStopSharing: jest.fn(),
                });
                const component = getComponent({ displayStatus, beacon: defaultBeacon });
                expect(component.text()).toContain('Live location error');
                // retry button
                expect(findByTestId(component, 'beacon-status-stop-beacon-retry').length).toBeTruthy();
            });

            it('retry button retries stop sharing', () => {
                const displayStatus = BeaconDisplayStatus.Active;
                const onStopSharing = jest.fn();
                mocked(useOwnLiveBeacons).mockReturnValue({
                    hasStopSharingError: true,
                    onStopSharing,
                });
                const component = getComponent({ displayStatus, beacon: defaultBeacon });
                act(() => {
                    findByTestId(component, 'beacon-status-stop-beacon-retry').at(0).simulate('click');
                });

                expect(onStopSharing).toHaveBeenCalled();
            });
        });
    });

    it('renders loading state correctly', () => {
        const component = getComponent();
        expect(component).toBeTruthy();
    });
});
