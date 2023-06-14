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

export const parseGeoUri = (uri: string): GeolocationCoordinates | undefined => {
    function parse(s: string): number | null {
        const ret = parseFloat(s);
        if (Number.isNaN(ret)) {
            return null;
        } else {
            return ret;
        }
    }

    const m = uri.match(/^\s*geo:(.*?)\s*$/);
    if (!m) return;
    const parts = m[1].split(";");
    const coords = parts[0].split(",");
    let uncertainty: number | null | undefined = undefined;
    for (const param of parts.slice(1)) {
        const m = param.match(/u=(.*)/);
        if (m) uncertainty = parse(m[1]);
    }
    const latitude = parse(coords[0]);
    const longitude = parse(coords[1]);

    if (latitude === null || longitude === null) {
        return;
    }

    return {
        latitude: latitude!,
        longitude: longitude!,
        altitude: parse(coords[2]),
        accuracy: uncertainty!,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
    };
};
