/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { TagID } from "../models";

/**
 * Represents an event preview.
 */
export interface IPreview {
    /**
     * Gets the text which represents the event as a preview.
     * @param event The event to preview.
     * @param tagId Optional. The tag where the room the event was sent in resides.
     * @returns The preview.
     */
    getTextFor(event: MatrixEvent, tagId?: TagID): string;
}
