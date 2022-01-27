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
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import {
    ASSET_NODE_TYPE,
    ASSET_TYPE_SELF,
    ILocationContent,
    LOCATION_EVENT_TYPE,
} from 'matrix-js-sdk/src/@types/location';
import { IClientWellKnown } from 'matrix-js-sdk/src/client';

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
import { getTileServerWellKnown, tileServerFromWellKnown } from '../../../utils/WellKnownUtils';
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

        this.context.on("WellKnown.client", this.updateStyleUrl);

        this.map = createMap(
            this.coords,
            false,
            this.bodyId,
            this.markerId,
            (e: Error) => this.setState({ error: e }),
        );
    }

    componentWillUnmount() {
        this.context.off("WellKnown.client", this.updateStyleUrl);
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
        return <LocationBodyContent
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
    const asset = ASSET_NODE_TYPE.findIn(locationContent) as { type: string };
    const assetType = asset?.type ?? ASSET_TYPE_SELF;
    return assetType == ASSET_TYPE_SELF;
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
                { markerContents }
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

/**
 * Look up what map tile server style URL was provided in the homeserver's
 * .well-known location, or, failing that, in our local config, or, failing
 * that, defaults to the same tile server listed by matrix.org.
 */
export function findMapStyleUrl(): string {
    const mapStyleUrl = (
        getTileServerWellKnown()?.map_style_url ??
        SdkConfig.get().map_style_url
    );

    if (!mapStyleUrl) {
        throw new Error(
            "'map_style_url' missing from homeserver .well-known area, and " +
            "missing from from config.json.",
        );
    }

    return mapStyleUrl;
}

export function createMap(
    coords: GeolocationCoordinates,
    interactive: boolean,
    bodyId: string,
    markerId: string,
    onError: (error: Error) => void,
): maplibregl.Map {
    try {
        const styleUrl = findMapStyleUrl();
        const coordinates = new maplibregl.LngLat(coords.longitude, coords.latitude);

        const map = new maplibregl.Map({
            container: bodyId,
            style: styleUrl,
            center: coordinates,
            zoom: 15,
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
    } catch (e) {
        logger.error("Failed to render map", e);
        onError(e);
    }
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
