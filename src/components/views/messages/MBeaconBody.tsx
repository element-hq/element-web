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

import React, { useContext, useEffect, useState } from 'react';
import { Beacon, BeaconEvent, MatrixEvent } from 'matrix-js-sdk/src/matrix';
import { BeaconLocationState } from 'matrix-js-sdk/src/content-helpers';
import { randomString } from 'matrix-js-sdk/src/randomstring';

import { Icon as LocationMarkerIcon } from '../../../../res/img/element-icons/location.svg';
import MatrixClientContext from '../../../contexts/MatrixClientContext';
import { useEventEmitterState } from '../../../hooks/useEventEmitter';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import { useBeacon } from '../../../utils/beacon';
import { isSelfLocation } from '../../../utils/location';
import { BeaconDisplayStatus, getBeaconDisplayStatus } from '../beacon/displayStatus';
import BeaconStatus from '../beacon/BeaconStatus';
import Spinner from '../elements/Spinner';
import Map from '../location/Map';
import SmartMarker from '../location/SmartMarker';
import OwnBeaconStatus from '../beacon/OwnBeaconStatus';
import BeaconViewDialog from '../beacon/BeaconViewDialog';
import { IBodyProps } from "./IBodyProps";

const useBeaconState = (beaconInfoEvent: MatrixEvent): {
    beacon?: Beacon;
    description?: string;
    latestLocationState?: BeaconLocationState;
    isLive?: boolean;
} => {
    const beacon = useBeacon(beaconInfoEvent);

    const isLive = useEventEmitterState(
        beacon,
        BeaconEvent.LivenessChange,
        () => beacon?.isLive);

    const latestLocationState = useEventEmitterState(
        beacon,
        BeaconEvent.LocationUpdate,
        () => beacon?.latestLocationState);

    if (!beacon) {
        return {};
    }

    const { description } = beacon.beaconInfo;

    return {
        beacon,
        description,
        isLive,
        latestLocationState,
    };
};

// multiple instances of same map might be in document
// eg thread and main timeline, reply
// maplibregl needs a unique id to attach the map instance to
const useUniqueId = (eventId: string): string => {
    const [id, setId] = useState(`${eventId}_${randomString(8)}`);

    useEffect(() => {
        setId(`${eventId}_${randomString(8)}`);
    }, [eventId]);

    return id;
};

const MBeaconBody: React.FC<IBodyProps> = React.forwardRef(({ mxEvent }, ref) => {
    const {
        beacon,
        isLive,
        latestLocationState,
    } = useBeaconState(mxEvent);
    const mapId = useUniqueId(mxEvent.getId());

    const matrixClient = useContext(MatrixClientContext);
    const [error, setError] = useState<Error>();
    const displayStatus = getBeaconDisplayStatus(isLive, latestLocationState, error);
    const markerRoomMember = isSelfLocation(mxEvent.getContent()) ? mxEvent.sender : undefined;
    const isOwnBeacon = beacon?.beaconInfoOwner === matrixClient.getUserId();

    const onClick = () => {
        if (displayStatus !== BeaconDisplayStatus.Active) {
            return;
        }
        Modal.createTrackedDialog(
            'Beacon View',
            '',
            BeaconViewDialog,
            {
                roomId: mxEvent.getRoomId(),
                matrixClient,
                focusBeacon: beacon,
            },
            "mx_BeaconViewDialog_wrapper",
            false, // isPriority
            true, // isStatic
        );
    };

    return (
        <div className='mx_MBeaconBody' ref={ref}>
            { displayStatus === BeaconDisplayStatus.Active ?
                <Map
                    id={mapId}
                    centerGeoUri={latestLocationState.uri}
                    onError={setError}
                    onClick={onClick}
                    className="mx_MBeaconBody_map"
                >
                    {
                        ({ map }) =>
                            <SmartMarker
                                map={map}
                                id={`${mapId}-marker`}
                                geoUri={latestLocationState.uri}
                                roomMember={markerRoomMember}
                                useMemberColor
                            />
                    }
                </Map>
                : <div className='mx_MBeaconBody_map mx_MBeaconBody_mapFallback'>
                    { displayStatus === BeaconDisplayStatus.Loading ?
                        <Spinner h={32} w={32} /> :
                        <LocationMarkerIcon className='mx_MBeaconBody_mapFallbackIcon' />
                    }
                </div>
            }
            { isOwnBeacon ?
                <OwnBeaconStatus
                    className='mx_MBeaconBody_chin'
                    beacon={beacon}
                    displayStatus={displayStatus}
                /> :
                <BeaconStatus
                    className='mx_MBeaconBody_chin'
                    beacon={beacon}
                    displayStatus={displayStatus}
                    label={_t('View live location')}
                    withIcon
                />
            }
        </div>
    );
});

export default MBeaconBody;

