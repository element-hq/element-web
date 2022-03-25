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

import React from 'react';
import maplibregl from 'maplibre-gl';
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import {
    M_ASSET,
    LocationAssetType,
    ILocationContent,
} from 'matrix-js-sdk/src/@types/location';
import { ClientEvent, IClientWellKnown } from 'matrix-js-sdk/src/client';

import { replaceableComponent } from "../../../utils/replaceableComponent";
import { IBodyProps } from "./IBodyProps";
import { _t } from '../../../languageHandler';
import MemberAvatar from '../avatars/MemberAvatar';
import Modal from '../../../Modal';
import {
    parseGeoUri,
    locationEventGeoUri,
    createMap,
    getLocationShareErrorMessage,
    LocationShareError,
} from '../../../utils/location';
import LocationViewDialog from '../location/LocationViewDialog';
import TooltipTarget from '../elements/TooltipTarget';
import { Alignment } from '../elements/Tooltip';
import AccessibleButton from '../elements/AccessibleButton';
import { tileServerFromWellKnown } from '../../../utils/WellKnownUtils';
import MatrixClientContext from '../../../contexts/MatrixClientContext';

interface IState {
    error: Error;
}

@replaceableComponent("views.messages.MLocationBody")
export default class MLocationBody extends React.Component<IBodyProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;
    private coords: GeolocationCoordinates;
    private bodyId: string;
    private markerId: string;
    private map?: maplibregl.Map = null;

    constructor(props: IBodyProps) {
        super(props);

        const randomString = Math.random().toString(16).slice(2, 10);
        const idSuffix = `${props.mxEvent.getId()}_${randomString}`;
        this.bodyId = `mx_MLocationBody_${idSuffix}`;
        this.markerId = `mx_MLocationBody_marker_${idSuffix}`;
        this.coords = parseGeoUri(locationEventGeoUri(this.props.mxEvent));

        this.state = {
            error: undefined,
        };
    }

    componentDidMount() {
        if (this.state.error) {
            return;
        }

        this.context.on(ClientEvent.ClientWellKnown, this.updateStyleUrl);

        this.map = createMap(
            this.coords,
            false,
            this.bodyId,
            this.markerId,
            (e: Error) => this.setState({ error: e }),
        );
    }

    componentWillUnmount() {
        this.context.off(ClientEvent.ClientWellKnown, this.updateStyleUrl);
    }

    private updateStyleUrl = (clientWellKnown: IClientWellKnown) => {
        const style = tileServerFromWellKnown(clientWellKnown)?.["map_style_url"];
        if (style) {
            this.map?.setStyle(style);
        }
    };

    private onClick = (
        event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    ) => {
        // Don't open map if we clicked the attribution button
        const target = event.target as Element;
        if (target.classList.contains("maplibregl-ctrl-attrib-button")) {
            return;
        }

        Modal.createTrackedDialog(
            'Location View',
            '',
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

    render(): React.ReactElement<HTMLDivElement> {
        return this.state.error ?
            <LocationBodyFallbackContent error={this.state.error} event={this.props.mxEvent} /> :
            <LocationBodyContent
                mxEvent={this.props.mxEvent}
                bodyId={this.bodyId}
                markerId={this.markerId}
                error={this.state.error}
                tooltip={_t("Expand map")}
                onClick={this.onClick}
            />;
    }
}

export function isSelfLocation(locationContent: ILocationContent): boolean {
    const asset = M_ASSET.findIn(locationContent) as { type: string };
    const assetType = asset?.type ?? LocationAssetType.Self;
    return assetType == LocationAssetType.Self;
}

interface ILocationBodyContentProps {
    mxEvent: MatrixEvent;
    bodyId: string;
    markerId: string;
    error: Error;
    tooltip?: string;
    onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
    zoomButtons?: boolean;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
}

export const LocationBodyFallbackContent: React.FC<{ event: MatrixEvent, error: Error }> = ({ error, event }) => {
    const errorType = error?.message as LocationShareError;
    const message = `${_t('Unable to load map')}: ${getLocationShareErrorMessage(errorType)}`;

    const locationFallback = isSelfLocation(event.getContent()) ?
        (_t('Shared their location: ') + event.getContent()?.body) :
        (_t('Shared a location: ') + event.getContent()?.body);

    return <div className="mx_EventTile_body">
        <span className={errorType !== LocationShareError.MapStyleUrlNotConfigured ? "mx_EventTile_tileError" : ''}>
            { message }
        </span>
        <br />
        { locationFallback }
    </div>;
};

export function LocationBodyContent(props: ILocationBodyContentProps):
        React.ReactElement<HTMLDivElement> {
    const mapDiv = <div
        id={props.bodyId}
        onClick={props.onClick}
        className="mx_MLocationBody_map"
    />;

    const markerContents = (
        isSelfLocation(props.mxEvent.getContent())
            ? <MemberAvatar
                member={props.mxEvent.sender}
                width={27}
                height={27}
                viewUserOnClick={false}
            />
            : <div className="mx_MLocationBody_markerContents" />
    );

    return <div className="mx_MLocationBody">
        {
            props.tooltip
                ? <TooltipTarget
                    label={props.tooltip}
                    alignment={Alignment.InnerBottom}
                    maxParentWidth={450}
                >
                    { mapDiv }
                </TooltipTarget>
                : mapDiv
        }
        <div className="mx_MLocationBody_marker" id={props.markerId}>
            <div className="mx_MLocationBody_markerBorder">
                { markerContents }
            </div>
            <div
                className="mx_MLocationBody_pointer"
            />
        </div>
        {
            props.zoomButtons
                ? <ZoomButtons
                    onZoomIn={props.onZoomIn}
                    onZoomOut={props.onZoomOut}
                />
                : null
        }
    </div>;
}

interface IZoomButtonsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
}

function ZoomButtons(props: IZoomButtonsProps): React.ReactElement<HTMLDivElement> {
    return <div className="mx_MLocationBody_zoomButtons">
        <AccessibleButton
            onClick={props.onZoomIn}
            title={_t("Zoom in")}
        >
            <div className="mx_MLocationBody_zoomButton mx_MLocationBody_plusButton" />
        </AccessibleButton>
        <AccessibleButton
            onClick={props.onZoomOut}
            title={_t("Zoom out")}
        >
            <div className="mx_MLocationBody_zoomButton mx_MLocationBody_minusButton" />
        </AccessibleButton>
    </div>;
}

