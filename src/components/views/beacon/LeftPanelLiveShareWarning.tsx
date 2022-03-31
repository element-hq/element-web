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

import classNames from 'classnames';
import React from 'react';

import { useEventEmitterState } from '../../../hooks/useEventEmitter';
import { _t } from '../../../languageHandler';
import { OwnBeaconStore, OwnBeaconStoreEvent } from '../../../stores/OwnBeaconStore';
import { Icon as LiveLocationIcon } from '../../../../res/img/location/live-location.svg';
import { ViewRoomPayload } from '../../../dispatcher/payloads/ViewRoomPayload';
import { Action } from '../../../dispatcher/actions';
import dispatcher from '../../../dispatcher/dispatcher';
import AccessibleButton from '../elements/AccessibleButton';

interface Props {
    isMinimized?: boolean;
}

/**
 * Choose the most relevant beacon
 * and get its roomId
 */
const chooseBestBeaconRoomId = (liveBeaconIds, errorBeaconIds): string | undefined => {
    // both lists are ordered by creation timestamp in store
    // so select latest beacon
    const beaconId = errorBeaconIds?.[0] ?? liveBeaconIds?.[0];
    if (!beaconId) {
        return undefined;
    }
    const beacon = OwnBeaconStore.instance.getBeaconById(beaconId);

    return beacon?.roomId;
};

const LeftPanelLiveShareWarning: React.FC<Props> = ({ isMinimized }) => {
    const isMonitoringLiveLocation = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.MonitoringLivePosition,
        () => OwnBeaconStore.instance.isMonitoringLiveLocation,
    );

    const beaconIdsWithWireError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.WireError,
        () => OwnBeaconStore.instance.getLiveBeaconIdsWithWireError(),
    );

    const liveBeaconIds = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.LivenessChange,
        () => OwnBeaconStore.instance.getLiveBeaconIds(),
    );

    const hasWireErrors = !!beaconIdsWithWireError.length;

    if (!isMonitoringLiveLocation) {
        return null;
    }

    const relevantBeaconRoomId = chooseBestBeaconRoomId(liveBeaconIds, beaconIdsWithWireError);

    const onWarningClick = relevantBeaconRoomId ? () => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: relevantBeaconRoomId,
            metricsTrigger: undefined,
        });
    } : undefined;

    const label = hasWireErrors ?
        _t('An error occured whilst sharing your live location') :
        _t('You are sharing your live location');

    return <AccessibleButton
        className={classNames('mx_LeftPanelLiveShareWarning', {
            'mx_LeftPanelLiveShareWarning__minimized': isMinimized,
            'mx_LeftPanelLiveShareWarning__error': hasWireErrors,
        })}
        title={isMinimized ? label : undefined}
        onClick={onWarningClick}
    >
        { isMinimized ? <LiveLocationIcon height={10} /> : label }
    </AccessibleButton>;
};

export default LeftPanelLiveShareWarning;
