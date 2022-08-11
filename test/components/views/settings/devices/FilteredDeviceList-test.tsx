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
import { render } from '@testing-library/react';

import FilteredDeviceList from '../../../../../src/components/views/settings/devices/FilteredDeviceList';

describe('<FilteredDeviceList />', () => {
    const noMetaDevice = { device_id: 'no-meta-device', isVerified: true };
    const oldDevice = { device_id: 'old', last_seen_ts: new Date(1993, 7, 3, 4).getTime(), isVerified: true };
    const newDevice = {
        device_id: 'new',
        last_seen_ts: new Date().getTime() - 500,
        last_seen_ip: '123.456.789',
        display_name: 'My Device',
        isVerified: true,
    };
    const defaultProps = {
        devices: {
            [noMetaDevice.device_id]: noMetaDevice,
            [oldDevice.device_id]: oldDevice,
            [newDevice.device_id]: newDevice,
        },
    };
    const getComponent = (props = {}) =>
        (<FilteredDeviceList {...defaultProps} {...props} />);

    it('renders devices in correct order', () => {
        const { container } = render(getComponent());
        const tiles = container.querySelectorAll('.mx_DeviceTile');
        expect(tiles[0].getAttribute('data-testid')).toEqual(`device-tile-${newDevice.device_id}`);
        expect(tiles[1].getAttribute('data-testid')).toEqual(`device-tile-${oldDevice.device_id}`);
        expect(tiles[2].getAttribute('data-testid')).toEqual(`device-tile-${noMetaDevice.device_id}`);
    });

    it('updates list order when devices change', () => {
        const updatedOldDevice = { ...oldDevice, last_seen_ts: new Date().getTime() };
        const updatedDevices = {
            [oldDevice.device_id]: updatedOldDevice,
            [newDevice.device_id]: newDevice,
        };
        const { container, rerender } = render(getComponent());

        rerender(getComponent({ devices: updatedDevices }));

        const tiles = container.querySelectorAll('.mx_DeviceTile');
        expect(tiles.length).toBe(2);
        expect(tiles[0].getAttribute('data-testid')).toEqual(`device-tile-${oldDevice.device_id}`);
        expect(tiles[1].getAttribute('data-testid')).toEqual(`device-tile-${newDevice.device_id}`);
    });
});
