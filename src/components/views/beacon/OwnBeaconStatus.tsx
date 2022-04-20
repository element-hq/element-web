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

import { Beacon } from 'matrix-js-sdk/src/matrix';
import React, { HTMLProps } from 'react';

import { _t } from '../../../languageHandler';
import { useOwnLiveBeacons } from '../../../utils/beacon';
import BeaconStatus from './BeaconStatus';
import { BeaconDisplayStatus } from './displayStatus';
import AccessibleButton from '../elements/AccessibleButton';

interface Props {
    displayStatus: BeaconDisplayStatus;
    beacon?: Beacon;
}

/**
 * Wraps BeaconStatus with more capabilities
 * for errors and actions available for users own live beacons
 */
const OwnBeaconStatus: React.FC<Props & HTMLProps<HTMLDivElement>> = ({
    beacon, displayStatus, className, ...rest
}) => {
    const {
        hasWireError,
        hasStopSharingError,
        stoppingInProgress,
        onStopSharing,
        onResetWireError,
    } = useOwnLiveBeacons([beacon?.identifier]);

    // combine display status with errors that only occur for user's own beacons
    const ownDisplayStatus = hasWireError || hasStopSharingError ?
        BeaconDisplayStatus.Error :
        displayStatus;

    return <BeaconStatus
        className='mx_MBeaconBody_chin'
        beacon={beacon}
        displayStatus={ownDisplayStatus}
        label={_t('Live location enabled')}
        displayLiveTimeRemaining
        withIcon
        {...rest}
    >
        { ownDisplayStatus === BeaconDisplayStatus.Active && <AccessibleButton
            data-test-id='beacon-status-stop-beacon'
            kind='link'
            onClick={onStopSharing}
            className='mx_OwnBeaconStatus_button mx_OwnBeaconStatus_destructiveButton'
            disabled={stoppingInProgress}
        >
            { _t('Stop') }
        </AccessibleButton>
        }
        { hasWireError && <AccessibleButton
            data-test-id='beacon-status-reset-wire-error'
            kind='link'
            onClick={onResetWireError}
            className='mx_OwnBeaconStatus_button mx_OwnBeaconStatus_destructiveButton'
        >
            { _t('Retry') }
        </AccessibleButton>
        }
        { hasStopSharingError && <AccessibleButton
            data-test-id='beacon-status-stop-beacon-retry'
            kind='link'
            onClick={onStopSharing}
            className='mx_OwnBeaconStatus_button mx_OwnBeaconStatus_destructiveButton'
        >
            { _t('Retry') }
        </AccessibleButton> }
    </BeaconStatus>;
};

export default OwnBeaconStatus;
