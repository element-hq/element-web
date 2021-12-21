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

interface IState {
    error: Error;
}

@replaceableComponent("views.messages.MLocationBody")
export default class MLocationBody extends React.Component<IBodyProps, IState> {
    private map: maplibregl.Map;
    private coords: GeolocationCoordinates;

    constructor(props: IBodyProps) {
        super(props);

        // unfortunately we're stuck supporting legacy `content.geo_uri`
        // events until the end of days, or until we figure out mutable
        // events - so folks can read their old chat history correctly.
        // https://github.com/matrix-org/matrix-doc/issues/3516
        const content = this.props.mxEvent.getContent();
        const loc = content[LOCATION_EVENT_TYPE.name];
        const uri = loc ? loc.uri : content['geo_uri'];

        this.coords = parseGeoUri(uri);
        this.state = {
            error: undefined,
        };
    }

    componentDidMount() {
        const config = SdkConfig.get();
        const coordinates = new maplibregl.LngLat(
            this.coords.longitude, this.coords.latitude);

        this.map = new maplibregl.Map({
            container: this.getBodyId(),
            style: config.map_style_url,
            center: coordinates,
            zoom: 13,
        });

        new maplibregl.Marker({
            element: document.getElementById(this.getMarkerId()),
            anchor: 'bottom',
            offset: [0, -1],
        })
            .setLngLat(coordinates)
            .addTo(this.map);

        this.map.on('error', (e)=>{
            logger.error(
                "Failed to load map: check map_style_url in config.json has a "
                + "valid URL and API key",
                e.error,
            );
            this.setState({ error: e.error });
        });
    }

    private getBodyId = () => {
        return `mx_MLocationBody_${this.props.mxEvent.getId()}`;
    };

    private getMarkerId = () => {
        return `mx_MLocationBody_marker_${this.props.mxEvent.getId()}`;
    };

    render() {
        const error = this.state.error ?
            <div className="mx_EventTile_tileError mx_EventTile_body">
                { _t("Failed to load map") }
            </div> : null;

        return <div className="mx_MLocationBody">
            <div id={this.getBodyId()} className="mx_MLocationBody_map" />
            { error }
            <div className="mx_MLocationBody_marker" id={this.getMarkerId()}>
                <div className="mx_MLocationBody_markerBorder">
                    <MemberAvatar
                        member={this.props.mxEvent.sender}
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
        </div>;
    }
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
