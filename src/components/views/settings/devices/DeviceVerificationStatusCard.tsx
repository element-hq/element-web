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
import DeviceSecurityCard from './DeviceSecurityCard';
import {
    DeviceSecurityVariation,
    DeviceWithVerification,
} from './types';

interface Props {
    device: DeviceWithVerification;
}

export const DeviceVerificationStatusCard: React.FC<Props> = ({
    device,
}) => {
    const securityCardProps = device?.isVerified ? {
        variation: DeviceSecurityVariation.Verified,
        heading: _t('Verified session'),
        description: _t('This session is ready for secure messaging.'),
    } : {
        variation: DeviceSecurityVariation.Unverified,
        heading: _t('Unverified session'),
        description: _t('Verify or sign out from this session for best security and reliability.'),
    };
    return <DeviceSecurityCard
        {...securityCardProps}
    />;
};
