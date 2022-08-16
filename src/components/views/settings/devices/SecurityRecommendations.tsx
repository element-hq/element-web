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

import { _t } from '../../../../languageHandler';
import AccessibleButton from '../../elements/AccessibleButton';
import SettingsSubsection from '../shared/SettingsSubsection';
import DeviceSecurityCard from './DeviceSecurityCard';
import { filterDevicesBySecurityRecommendation, INACTIVE_DEVICE_AGE_DAYS } from './filter';
import {
    DeviceSecurityVariation,
    DeviceWithVerification,
    DevicesDictionary,
} from './types';

interface Props {
    devices: DevicesDictionary;
}

const SecurityRecommendations: React.FC<Props> = ({ devices }) => {
    const devicesArray = Object.values<DeviceWithVerification>(devices);

    const unverifiedDevicesCount = filterDevicesBySecurityRecommendation(
        devicesArray,
        [DeviceSecurityVariation.Unverified],
    ).length;
    const inactiveDevicesCount = filterDevicesBySecurityRecommendation(
        devicesArray,
        [DeviceSecurityVariation.Inactive],
    ).length;

    if (!(unverifiedDevicesCount | inactiveDevicesCount)) {
        return null;
    }

    const inactiveAgeDays = INACTIVE_DEVICE_AGE_DAYS;

    // TODO(kerrya) stubbed until PSG-640/652
    const noop = () => {};

    return <SettingsSubsection
        heading={_t('Security recommendations')}
        description={_t('Improve your account security by following these recommendations')}
        data-testid='security-recommendations-section'
    >
        {
            !!unverifiedDevicesCount &&
            <DeviceSecurityCard
                variation={DeviceSecurityVariation.Unverified}
                heading={_t('Unverified sessions')}
                description={_t(
                    `Verify your sessions for enhanced secure messaging` +
                    ` or sign out from those you don't recognize or use anymore.`,
                )}
            >
                <AccessibleButton
                    kind='link_inline'
                    onClick={noop}
                >
                    { _t('View all') + ` (${unverifiedDevicesCount})` }
                </AccessibleButton>
            </DeviceSecurityCard>
        }
        {
            !!inactiveDevicesCount &&
            <>
                { !!unverifiedDevicesCount && <div className='mx_SecurityRecommendations_spacing' /> }
                <DeviceSecurityCard
                    variation={DeviceSecurityVariation.Inactive}
                    heading={_t('Inactive sessions')}
                    description={_t(
                        `Consider signing out from old sessions ` +
                        `(%(inactiveAgeDays)s days or older) you don't use anymore`,
                        { inactiveAgeDays },
                    )}
                >
                    <AccessibleButton
                        kind='link_inline'
                        onClick={noop}
                    >
                        { _t('View all') + ` (${inactiveDevicesCount})` }
                    </AccessibleButton>
                </DeviceSecurityCard>
            </>
        }
    </SettingsSubsection>;
};

export default SecurityRecommendations;
