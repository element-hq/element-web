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
import { logger } from "matrix-js-sdk/src/logger";
import { LOCATION_EVENT_TYPE } from 'matrix-js-sdk/src/@types/location';
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';

import SdkConfig from '../../../SdkConfig';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { IBodyProps } from "./IBodyProps";
import { _t } from '../../../languageHandler';
import MemberAvatar from '../avatars/MemberAvatar';
import Modal from '../../../Modal';
import LocationViewDialog from '../location/LocationViewDialog';
import TooltipTarget from '../elements/TooltipTarget';
import { Alignment } from '../elements/Tooltip';
import AccessibleButton from '../elements/AccessibleButton';

interface IState {
    error: Error;
}

@replaceableComponent("views.messages.MLocationBody")
export default class MLocationBody extends React.Component<IBodyProps, IState> {
    private coords: GeolocationCoordinates;

    constructor(props: IBodyProps) {
        super(props);

        this.coords = parseGeoUri(locationEventGeoUri(this.props.mxEvent));
        this.state = {
            error: undefined,
        };
    }

    componentDidMount() {
        if (this.state.error) {
            return;
        }

        createMap(
            this.coords,
            false,
            this.getBodyId(),
            this.getMarkerId(),
            (e: Error) => this.setState({ error: e }),
        );
    }

    private getBodyId = () => {
        return `mx_MLocationBody_${this.props.mxEvent.getId()}`;
    };

    private getMarkerId = () => {
        return `mx_MLocationBody_marker_${this.props.mxEvent.getId()}`;
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
            { mxEvent: this.props.mxEvent },
            "mx_LocationViewDialog_wrapper",
            false, // isPriority
            true, // isStatic
        );
    };

    render(): React.ReactElement<HTMLDivElement> {
        return <LocationBodyContent
            mxEvent={this.props.mxEvent}
            bodyId={this.getBodyId()}
            markerId={this.getMarkerId()}
            error={this.state.error}
            tooltip={_t("Expand map")}
            onClick={this.onClick}
        />;
    }
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

export function LocationBodyContent(props: ILocationBodyContentProps):
        React.ReactElement<HTMLDivElement> {
    const mapDiv = <div
        id={props.bodyId}
        onClick={props.onClick}
        className="mx_MLocationBody_map"
    />;

    return <div className="mx_MLocationBody">
        {
            props.error
                ? <div className="mx_EventTile_tileError mx_EventTile_body">
                    { _t("Failed to load map") }
                </div>
                : null
        }
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
                <MemberAvatar
                    member={props.mxEvent.sender}
                    width={27}
                    height={27}
                    viewUserOnClick={false}
                />
            </div>
            <img
                className="mx_MLocationBody_pointer"
                src={require("../../../../res/img/location/pointer.svg")}
                width="9"
                height="5"
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

export function createMap(
    coords: GeolocationCoordinates,
    interactive: boolean,
    bodyId: string,
    markerId: string,
    onError: (error: Error) => void,
): maplibregl.Map {
    const styleUrl = SdkConfig.get().map_style_url;
    const coordinates = new maplibregl.LngLat(coords.longitude, coords.latitude);

    const map = new maplibregl.Map({
        container: bodyId,
        style: styleUrl,
        center: coordinates,
        zoom: 13,
        interactive,
    });

    new maplibregl.Marker({
        element: document.getElementById(markerId),
        anchor: 'bottom',
        offset: [0, -1],
    })
        .setLngLat(coordinates)
        .addTo(map);

    map.on('error', (e) => {
        logger.error(
            "Failed to load map: check map_style_url in config.json has a "
            + "valid URL and API key",
            e.error,
        );
        onError(e.error);
    });

    return map;
}

/**
 * Find the geo-URI contained within a location event.
 */
export function locationEventGeoUri(mxEvent: MatrixEvent): string {
    // unfortunately we're stuck supporting legacy `content.geo_uri`
    // events until the end of days, or until we figure out mutable
    // events - so folks can read their old chat history correctly.
    // https://github.com/matrix-org/matrix-doc/issues/3516
    const content = mxEvent.getContent();
    const loc = LOCATION_EVENT_TYPE.findIn(content) as { uri?: string };
    return loc ? loc.uri : content['geo_uri'];
}

export function parseGeoUri(uri: string): GeolocationCoordinates {
    function parse(s: string): number {
        const ret = parseFloat(s);
        if (Number.isNaN(ret)) {
            return undefined;
        } else {
            return ret;
        }
    }

    const m = uri.match(/^\s*geo:(.*?)\s*$/);
    if (!m) return;
    const parts = m[1].split(';');
    const coords = parts[0].split(',');
    let uncertainty: number;
    for (const param of parts.slice(1)) {
        const m = param.match(/u=(.*)/);
        if (m) uncertainty = parse(m[1]);
    }
    return {
        latitude: parse(coords[0]),
        longitude: parse(coords[1]),
        altitude: parse(coords[2]),
        accuracy: uncertainty,
        altitudeAccuracy: undefined,
        heading: undefined,
        speed: undefined,
    };
}

function makeLink(coords: GeolocationCoordinates): string {
    return (
        "https://www.openstreetmap.org/" +
        `?mlat=${coords.latitude}` +
        `&mlon=${coords.longitude}` +
        `#map=16/${coords.latitude}/${coords.longitude}`
    );
}

export function createMapSiteLink(event: MatrixEvent): string {
    const content: Object = event.getContent();
    const mLocation = content[LOCATION_EVENT_TYPE.name];
    if (mLocation !== undefined) {
        const uri = mLocation["uri"];
        if (uri !== undefined) {
            return makeLink(parseGeoUri(uri));
        }
    } else {
        const geoUri = content["geo_uri"];
        if (geoUri) {
            return makeLink(parseGeoUri(geoUri));
        }
    }
    return null;
}
