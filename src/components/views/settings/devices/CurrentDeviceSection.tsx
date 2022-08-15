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

import React, { useState } from 'react';

import { _t } from '../../../../languageHandler';
import Spinner from '../../elements/Spinner';
import SettingsSubsection from '../shared/SettingsSubsection';
import DeviceDetails from './DeviceDetails';
import DeviceExpandDetailsButton from './DeviceExpandDetailsButton';
import DeviceSecurityCard from './DeviceSecurityCard';
import DeviceTile from './DeviceTile';
import {
    DeviceSecurityVariation,
    DeviceWithVerification,
} from './types';

interface Props {
    device?: DeviceWithVerification;
    isLoading: boolean;
}

const CurrentDeviceSection: React.FC<Props> = ({
    device, isLoading,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const securityCardProps = device?.isVerified ? {
        variation: DeviceSecurityVariation.Verified,
        heading: _t('Verified session'),
        description: _t('This session is ready for secure messaging.'),
    } : {
        variation: DeviceSecurityVariation.Unverified,
        heading: _t('Unverified session'),
        description: _t('Verify or sign out from this session for best security and reliability.'),
    };
    return <SettingsSubsection
        heading={_t('Current session')}
        data-testid='current-session-section'
    >
        { isLoading && <Spinner /> }
        { !!device && <>
            <DeviceTile
                device={device}
            >
                <DeviceExpandDetailsButton
                    data-testid='current-session-toggle-details'
                    isExpanded={isExpanded}
                    onClick={() => setIsExpanded(!isExpanded)}
                />
            </DeviceTile>
            { isExpanded && <DeviceDetails device={device} /> }
            <br />
            <DeviceSecurityCard
                {...securityCardProps}
            />
        </>
        }
    </SettingsSubsection>;
};

export default CurrentDeviceSection;
