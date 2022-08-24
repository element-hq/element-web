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

import DeviceDetails from '../../../../../src/components/views/settings/devices/DeviceDetails';

describe('<DeviceDetails />', () => {
    const baseDevice = {
        device_id: 'my-device',
        isVerified: false,
    };
    const defaultProps = {
        device: baseDevice,
    };
    const getComponent = (props = {}) => <DeviceDetails {...defaultProps} {...props} />;
    // 14.03.2022 16:15
    const now = 1647270879403;
    jest.useFakeTimers();

    beforeEach(() => {
        jest.setSystemTime(now);
    });

    it('renders device without metadata', () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it('renders device with metadata', () => {
        const device = {
            ...baseDevice,
            display_name: 'My Device',
            last_seen_ip: '123.456.789',
            last_seen_ts: now - 60000000,
        };
        const { container } = render(getComponent({ device }));
        expect(container).toMatchSnapshot();
    });

    it('renders a verified device', () => {
        const device = {
            ...baseDevice,
            isVerified: true,
        };
        const { container } = render(getComponent({ device }));
        expect(container).toMatchSnapshot();
    });
});
