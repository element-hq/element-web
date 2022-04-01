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

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { Room, Beacon } from 'matrix-js-sdk/src/matrix';

import { formatDuration } from '../../../DateUtils';
import { _t } from '../../../languageHandler';
import { useEventEmitterState } from '../../../hooks/useEventEmitter';
import { useInterval } from '../../../hooks/useTimeout';
import { OwnBeaconStore, OwnBeaconStoreEvent } from '../../../stores/OwnBeaconStore';
import { getBeaconMsUntilExpiry, sortBeaconsByLatestExpiry } from '../../../utils/beacon';
import AccessibleButton from '../elements/AccessibleButton';
import Spinner from '../elements/Spinner';
import StyledLiveBeaconIcon from './StyledLiveBeaconIcon';
import { Icon as CloseIcon } from '../../../../res/img/image-view/close.svg';

const MINUTE_MS = 60000;
const HOUR_MS = MINUTE_MS * 60;

const getUpdateInterval = (ms: number) => {
    // every 10 mins when more than an hour
    if (ms > HOUR_MS) {
        return MINUTE_MS * 10;
    }
    // every minute when more than a minute
    if (ms > MINUTE_MS) {
        return MINUTE_MS;
    }
    // otherwise every second
    return 1000;
};
const useMsRemaining = (beacon: Beacon): number => {
    const [msRemaining, setMsRemaining] = useState(() => getBeaconMsUntilExpiry(beacon));

    useEffect(() => {
        setMsRemaining(getBeaconMsUntilExpiry(beacon));
    }, [beacon]);

    const updateMsRemaining = useCallback(() => {
        const ms = getBeaconMsUntilExpiry(beacon);
        setMsRemaining(ms);
    }, [beacon]);

    useInterval(updateMsRemaining, getUpdateInterval(msRemaining));

    return msRemaining;
};

/**
 * It's technically possible to have multiple live beacons in one room
 * Select the latest expiry to display,
 * and kill all beacons on stop sharing
 */
type LiveBeaconsState = {
    beacon?: Beacon;
    onStopSharing?: () => void;
    onResetWireError?: () => void;
    stoppingInProgress?: boolean;
    hasStopSharingError?: boolean;
    hasWireError?: boolean;
};
const useLiveBeacons = (liveBeaconIds: string[], roomId: string): LiveBeaconsState => {
    const [stoppingInProgress, setStoppingInProgress] = useState(false);
    const [error, setError] = useState<Error>();

    const hasWireError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.WireError,
        () =>
            OwnBeaconStore.instance.hasWireErrors(roomId),
    );

    // reset stopping in progress on change in live ids
    useEffect(() => {
        setStoppingInProgress(false);
        setError(undefined);
    }, [liveBeaconIds]);

    // select the beacon with latest expiry to display expiry time
    const beacon = liveBeaconIds.map(beaconId => OwnBeaconStore.instance.getBeaconById(beaconId))
        .sort(sortBeaconsByLatestExpiry)
        .shift();

    const onStopSharing = async () => {
        setStoppingInProgress(true);
        try {
            await Promise.all(liveBeaconIds.map(beaconId => OwnBeaconStore.instance.stopBeacon(beaconId)));
        } catch (error) {
            // only clear loading in case of error
            // to avoid flash of not-loading state
            // after beacons have been stopped but we wait for sync
            setError(error);
            setStoppingInProgress(false);
        }
    };

    const onResetWireError = () => {
        liveBeaconIds.map(beaconId => OwnBeaconStore.instance.resetWireError(beaconId));
    };

    return {
        onStopSharing,
        onResetWireError,
        beacon,
        stoppingInProgress,
        hasWireError,
        hasStopSharingError: !!error,
    };
};

const LiveTimeRemaining: React.FC<{ beacon: Beacon }> = ({ beacon }) => {
    const msRemaining = useMsRemaining(beacon);

    const timeRemaining = formatDuration(msRemaining);
    const liveTimeRemaining = _t(`%(timeRemaining)s left`, { timeRemaining });

    return <span
        data-test-id='room-live-share-expiry'
        className="mx_RoomLiveShareWarning_expiry"
    >{ liveTimeRemaining }</span>;
};

const getLabel = (hasWireError: boolean, hasStopSharingError: boolean): string => {
    if (hasWireError) {
        return _t('An error occured whilst sharing your live location, please try again');
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
        onResetWireError,
        beacon,
        stoppingInProgress,
        hasStopSharingError,
        hasWireError,
    } = useLiveBeacons(liveBeaconIds, roomId);

    if (!beacon) {
        return null;
    }

    const hasError = hasStopSharingError || hasWireError;

    const onButtonClick = () => {
        if (hasWireError) {
            onResetWireError();
        } else {
            onStopSharing();
        }
    };

    return <div
        className={classNames('mx_RoomLiveShareWarning')}
    >
        <StyledLiveBeaconIcon className="mx_RoomLiveShareWarning_icon" withError={hasError} />

        <span className="mx_RoomLiveShareWarning_label">
            { getLabel(hasWireError, hasStopSharingError) }
        </span>

        { stoppingInProgress &&
            <span className='mx_RoomLiveShareWarning_spinner'><Spinner h={16} w={16} /></span>
        }
        { !stoppingInProgress && !hasError && <LiveTimeRemaining beacon={beacon} /> }

        <AccessibleButton
            data-test-id='room-live-share-primary-button'
            onClick={onButtonClick}
            kind='danger'
            element='button'
            disabled={stoppingInProgress}
        >
            { hasError ? _t('Retry') : _t('Stop sharing') }
        </AccessibleButton>
        { hasWireError && <AccessibleButton
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
