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

import EventTile from "../rooms/EventTile";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";

export interface IMediaBody {
    getMediaHelper(): MediaEventHelper;
}

export function canTileDownload(tile: EventTile): boolean {
    if (!tile) return false;

    // Cast so we can check for IMediaBody interface safely.
    // Note that we don't cast to the IMediaBody interface as that causes IDEs
    // to complain about conditions always being true.
    const tileAsAny = <any>tile;
    return !!tileAsAny.getMediaHelper;
}
