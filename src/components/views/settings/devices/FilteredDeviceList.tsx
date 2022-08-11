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

import DeviceTile from './DeviceTile';
import { filterDevicesBySecurityRecommendation } from './filter';
import { DevicesDictionary, DeviceWithVerification } from './useOwnDevices';

interface Props {
    devices: DevicesDictionary;
}

// devices without timestamp metadata should be sorted last
const sortDevicesByLatestActivity = (left: DeviceWithVerification, right: DeviceWithVerification) =>
    (right.last_seen_ts || 0) - (left.last_seen_ts || 0);

const getFilteredSortedDevices = (devices: DevicesDictionary) =>
    filterDevicesBySecurityRecommendation(Object.values(devices), [])
        .sort(sortDevicesByLatestActivity);

/**
 * Filtered list of devices
 * Sorted by latest activity descending
 * TODO(kerrya) Filtering to added as part of PSG-648
 */
const FilteredDeviceList: React.FC<Props> = ({ devices }) => {
    const sortedDevices = getFilteredSortedDevices(devices);

    return <ol className='mx_FilteredDeviceList'>
        { sortedDevices.map((device) =>
            <li key={device.device_id}>
                <DeviceTile
                    device={device}
                />
            </li>,

        ) }
    </ol>;
};

export default FilteredDeviceList;
