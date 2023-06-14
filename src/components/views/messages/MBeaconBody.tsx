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

import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    Beacon,
    BeaconEvent,
    MatrixEvent,
    MatrixEventEvent,
    MatrixClient,
    RelationType,
    IRedactOpts,
} from "matrix-js-sdk/src/matrix";
import { BeaconLocationState } from "matrix-js-sdk/src/content-helpers";
import { randomString } from "matrix-js-sdk/src/randomstring";
import { M_BEACON } from "matrix-js-sdk/src/@types/beacon";
import classNames from "classnames";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import { isBeaconWaitingToStart, useBeacon } from "../../../utils/beacon";
import { isSelfLocation, LocationShareError } from "../../../utils/location";
import { BeaconDisplayStatus, getBeaconDisplayStatus } from "../beacon/displayStatus";
import BeaconStatus from "../beacon/BeaconStatus";
import OwnBeaconStatus from "../beacon/OwnBeaconStatus";
import Map from "../location/Map";
import { MapError } from "../location/MapError";
import MapFallback from "../location/MapFallback";
import SmartMarker from "../location/SmartMarker";
import { GetRelationsForEvent } from "../rooms/EventTile";
import BeaconViewDialog from "../beacon/BeaconViewDialog";
import { IBodyProps } from "./IBodyProps";

const useBeaconState = (
    beaconInfoEvent: MatrixEvent,
): {
    beacon?: Beacon;
    description?: string;
    latestLocationState?: BeaconLocationState;
    isLive?: boolean;
    waitingToStart?: boolean;
} => {
    const beacon = useBeacon(beaconInfoEvent);

    const isLive = useEventEmitterState(beacon, BeaconEvent.LivenessChange, () => beacon?.isLive);

    const latestLocationState = useEventEmitterState(
        beacon,
        BeaconEvent.LocationUpdate,
        () => beacon?.latestLocationState,
    );

    if (!beacon) {
        return {};
    }

    // a beacon's starting timestamp can be in the future
    // (either from small deviations in system clock times, or on purpose from another client)
    // a beacon is only live between its start timestamp and expiry
    // detect when a beacon is waiting to become live
    // and display a loading state
    const waitingToStart = !!beacon && isBeaconWaitingToStart(beacon);
    const { description } = beacon.beaconInfo;

    return {
        beacon,
        description,
        isLive,
        waitingToStart,
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

// remove related beacon locations on beacon redaction
const useHandleBeaconRedaction = (
    event: MatrixEvent,
    matrixClient: MatrixClient,
    getRelationsForEvent?: GetRelationsForEvent,
): void => {
    const onBeforeBeaconInfoRedaction = useCallback(
        (_event: MatrixEvent, redactionEvent: MatrixEvent) => {
            const relations = getRelationsForEvent
                ? getRelationsForEvent(event.getId()!, RelationType.Reference, M_BEACON.name)
                : undefined;

            relations?.getRelations()?.forEach((locationEvent) => {
                matrixClient.redactEvent(
                    locationEvent.getRoomId()!,
                    locationEvent.getId()!,
                    undefined,
                    redactionEvent.getContent<IRedactOpts>(),
                );
            });
        },
        [event, matrixClient, getRelationsForEvent],
    );

    useEffect(() => {
        event.addListener(MatrixEventEvent.BeforeRedaction, onBeforeBeaconInfoRedaction);
        return () => {
            event.removeListener(MatrixEventEvent.BeforeRedaction, onBeforeBeaconInfoRedaction);
        };
    }, [event, onBeforeBeaconInfoRedaction]);
};

const MBeaconBody = React.forwardRef<HTMLDivElement, IBodyProps>(({ mxEvent, getRelationsForEvent }, ref) => {
    const { beacon, isLive, latestLocationState, waitingToStart } = useBeaconState(mxEvent);
    const mapId = useUniqueId(mxEvent.getId()!);

    const matrixClient = useContext(MatrixClientContext);
    const [error, setError] = useState<Error>();
    const isMapDisplayError =
        error?.message === LocationShareError.MapStyleUrlNotConfigured ||
        error?.message === LocationShareError.MapStyleUrlNotReachable;
    const displayStatus = getBeaconDisplayStatus(
        !!isLive,
        latestLocationState,
        // if we are unable to display maps because it is not configured for the server
        // don't display an error
        isMapDisplayError ? undefined : error,
        waitingToStart,
    );
    const markerRoomMember = isSelfLocation(mxEvent.getContent()) ? mxEvent.sender : undefined;
    const isOwnBeacon = beacon?.beaconInfoOwner === matrixClient.getUserId();

    useHandleBeaconRedaction(mxEvent, matrixClient, getRelationsForEvent);

    const onClick = (): void => {
        if (displayStatus !== BeaconDisplayStatus.Active) {
            return;
        }
        Modal.createDialog(
            BeaconViewDialog,
            {
                roomId: mxEvent.getRoomId()!,
                matrixClient,
                initialFocusedBeacon: beacon,
            },
            "mx_BeaconViewDialog_wrapper",
            false, // isPriority
            true, // isStatic
        );
    };

    let map: JSX.Element;
    if (displayStatus === BeaconDisplayStatus.Active && !isMapDisplayError && latestLocationState?.uri) {
        map = (
            <Map
                id={mapId}
                centerGeoUri={latestLocationState.uri}
                onError={setError}
                onClick={onClick}
                className="mx_MBeaconBody_map"
            >
                {({ map }) => (
                    <SmartMarker
                        map={map}
                        id={`${mapId}-marker`}
                        geoUri={latestLocationState.uri!}
                        roomMember={markerRoomMember ?? undefined}
                        useMemberColor
                    />
                )}
            </Map>
        );
    } else if (isMapDisplayError) {
        map = (
            <MapError
                error={error.message as LocationShareError}
                onClick={onClick}
                className={classNames(
                    "mx_MBeaconBody_mapError",
                    // set interactive class when maximised map can be opened
                    { mx_MBeaconBody_mapErrorInteractive: displayStatus === BeaconDisplayStatus.Active },
                )}
                isMinimised
            />
        );
    } else {
        map = (
            <MapFallback
                isLoading={displayStatus === BeaconDisplayStatus.Loading}
                className="mx_MBeaconBody_map mx_MBeaconBody_mapFallback"
            />
        );
    }

    return (
        <div className="mx_MBeaconBody" ref={ref}>
            {map}
            {isOwnBeacon ? (
                <OwnBeaconStatus
                    className="mx_MBeaconBody_chin"
                    beacon={beacon}
                    displayStatus={displayStatus}
                    withIcon
                />
            ) : (
                <BeaconStatus
                    className="mx_MBeaconBody_chin"
                    beacon={beacon}
                    displayStatus={displayStatus}
                    label={_t("View live location")}
                    withIcon
                />
            )}
        </div>
    );
});

export default MBeaconBody;
