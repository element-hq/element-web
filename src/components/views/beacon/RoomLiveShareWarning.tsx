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
import { Room } from 'matrix-js-sdk/src/matrix';

import { _t } from '../../../languageHandler';
import { useEventEmitterState } from '../../../hooks/useEventEmitter';
import { OwnBeaconStore, OwnBeaconStoreEvent } from '../../../stores/OwnBeaconStore';
import { useOwnLiveBeacons } from '../../../utils/beacon';
import AccessibleButton from '../elements/AccessibleButton';
import Spinner from '../elements/Spinner';
import StyledLiveBeaconIcon from './StyledLiveBeaconIcon';
import { Icon as CloseIcon } from '../../../../res/img/image-view/close.svg';
import LiveTimeRemaining from './LiveTimeRemaining';

const getLabel = (hasLocationPublishError: boolean, hasStopSharingError: boolean): string => {
    if (hasLocationPublishError) {
        return _t('An error occurred whilst sharing your live location, please try again');
    }
    if (hasStopSharingError) {
        return _t('An error occurred while stopping your live location, please try again');
    }
    return _t('You are sharing your live location');
};

interface RoomLiveShareWarningInnerProps {
    liveBeaconIds: string[];
    roomId: Room['roomId'];
}
const RoomLiveShareWarningInner: React.FC<RoomLiveShareWarningInnerProps> = ({ liveBeaconIds, roomId }) => {
    const {
        onStopSharing,
        onResetLocationPublishError,
        beacon,
        stoppingInProgress,
        hasStopSharingError,
        hasLocationPublishError,
    } = useOwnLiveBeacons(liveBeaconIds);

    if (!beacon) {
        return null;
    }

    const hasError = hasStopSharingError || hasLocationPublishError;

    const onButtonClick = () => {
        if (hasLocationPublishError) {
            onResetLocationPublishError();
        } else {
            onStopSharing();
        }
    };

    return <div
        className='mx_RoomLiveShareWarning'
    >
        <StyledLiveBeaconIcon className="mx_RoomLiveShareWarning_icon" withError={hasError} />

        <span className="mx_RoomLiveShareWarning_label">
            { getLabel(hasLocationPublishError, hasStopSharingError) }
        </span>

        { stoppingInProgress &&
            <span className='mx_RoomLiveShareWarning_spinner'><Spinner h={16} w={16} /></span>
        }
        { !stoppingInProgress && !hasError && <LiveTimeRemaining beacon={beacon} /> }

        <AccessibleButton
            className='mx_RoomLiveShareWarning_stopButton'
            data-test-id='room-live-share-primary-button'
            onClick={onButtonClick}
            kind='danger'
            element='button'
            disabled={stoppingInProgress}
        >
            { hasError ? _t('Retry') : _t('Stop sharing') }
        </AccessibleButton>
        { hasLocationPublishError && <AccessibleButton
            data-test-id='room-live-share-wire-error-close-button'
            title={_t('Stop sharing and close')}
            element='button'
            className='mx_RoomLiveShareWarning_closeButton'
            onClick={onStopSharing}
        >
            <CloseIcon className='mx_RoomLiveShareWarning_closeButtonIcon' />
        </AccessibleButton> }
    </div>;
};

interface Props {
    roomId: Room['roomId'];
}
const RoomLiveShareWarning: React.FC<Props> = ({ roomId }) => {
    // do we have an active geolocation.watchPosition
    const isMonitoringLiveLocation = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.MonitoringLivePosition,
        () => OwnBeaconStore.instance.isMonitoringLiveLocation,
    );

    const liveBeaconIds = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.LivenessChange,
        () => OwnBeaconStore.instance.getLiveBeaconIds(roomId),
    );

    if (!isMonitoringLiveLocation || !liveBeaconIds.length) {
        return null;
    }

    // split into outer/inner to avoid watching various parts of live beacon state
    // when there are none
    return <RoomLiveShareWarningInner liveBeaconIds={liveBeaconIds} roomId={roomId} />;
};

export default RoomLiveShareWarning;
