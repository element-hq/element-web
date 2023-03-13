/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { randomString } from "matrix-js-sdk/src/randomstring";
import { ClientEvent, ClientEventHandlerMap } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import {
    locationEventGeoUri,
    getLocationShareErrorMessage,
    LocationShareError,
    isSelfLocation,
} from "../../../utils/location";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import TooltipTarget from "../elements/TooltipTarget";
import { Alignment } from "../elements/Tooltip";
import LocationViewDialog from "../location/LocationViewDialog";
import Map from "../location/Map";
import SmartMarker from "../location/SmartMarker";
import { IBodyProps } from "./IBodyProps";
import { createReconnectedListener } from "../../../utils/connection";

interface IState {
    error?: Error;
}

export default class MLocationBody extends React.Component<IBodyProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    private unmounted = false;
    private mapId: string;
    private reconnectedListener: ClientEventHandlerMap[ClientEvent.Sync];

    public constructor(props: IBodyProps) {
        super(props);

        // multiple instances of same map might be in document
        // eg thread and main timeline, reply
        const idSuffix = `${props.mxEvent.getId()}_${randomString(8)}`;
        this.mapId = `mx_MLocationBody_${idSuffix}`;

        this.reconnectedListener = createReconnectedListener(this.clearError);

        this.state = {};
    }

    private onClick = (): void => {
        Modal.createDialog(
            LocationViewDialog,
            {
                matrixClient: this.context,
                mxEvent: this.props.mxEvent,
            },
            "mx_LocationViewDialog_wrapper",
            false, // isPriority
            true, // isStatic
        );
    };

    private clearError = (): void => {
        this.context.off(ClientEvent.Sync, this.reconnectedListener);
        this.setState({ error: undefined });
    };

    private onError = (error: Error): void => {
        if (this.unmounted) return;
        this.setState({ error });
        // Unregister first in case we already had it registered
        this.context.off(ClientEvent.Sync, this.reconnectedListener);
        this.context.on(ClientEvent.Sync, this.reconnectedListener);
    };

    public componentWillUnmount(): void {
        this.unmounted = true;
        this.context.off(ClientEvent.Sync, this.reconnectedListener);
    }

    public render(): React.ReactElement<HTMLDivElement> {
        return this.state.error ? (
            <LocationBodyFallbackContent error={this.state.error} event={this.props.mxEvent} />
        ) : (
            <LocationBodyContent
                mxEvent={this.props.mxEvent}
                mapId={this.mapId}
                onError={this.onError}
                tooltip={_t("Expand map")}
                onClick={this.onClick}
            />
        );
    }
}

export const LocationBodyFallbackContent: React.FC<{ event: MatrixEvent; error: Error }> = ({ error, event }) => {
    const errorType = error?.message as LocationShareError;
    const message = `${_t("Unable to load map")}: ${getLocationShareErrorMessage(errorType)}`;

    const locationFallback = isSelfLocation(event.getContent())
        ? _t("Shared their location: ") + event.getContent()?.body
        : _t("Shared a location: ") + event.getContent()?.body;

    return (
        <div className="mx_EventTile_body mx_MLocationBody">
            <span className={errorType !== LocationShareError.MapStyleUrlNotConfigured ? "mx_EventTile_tileError" : ""}>
                {message}
            </span>
            <br />
            {locationFallback}
        </div>
    );
};

interface LocationBodyContentProps {
    mxEvent: MatrixEvent;
    mapId: string;
    tooltip?: string;
    onError: (error: Error) => void;
    onClick?: () => void;
}
export const LocationBodyContent: React.FC<LocationBodyContentProps> = ({
    mxEvent,
    mapId,
    tooltip,
    onError,
    onClick,
}) => {
    // only pass member to marker when should render avatar marker
    const markerRoomMember = isSelfLocation(mxEvent.getContent()) ? mxEvent.sender : undefined;
    const geoUri = locationEventGeoUri(mxEvent);

    const mapElement = (
        <Map id={mapId} centerGeoUri={geoUri} onClick={onClick} onError={onError} className="mx_MLocationBody_map">
            {({ map }) => (
                <SmartMarker
                    map={map}
                    id={`${mapId}-marker`}
                    geoUri={geoUri}
                    roomMember={markerRoomMember ?? undefined}
                />
            )}
        </Map>
    );

    return (
        <div className="mx_MLocationBody">
            {tooltip ? (
                <TooltipTarget label={tooltip} alignment={Alignment.InnerBottom} maxParentWidth={450}>
                    {mapElement}
                </TooltipTarget>
            ) : (
                mapElement
            )}
        </div>
    );
};
