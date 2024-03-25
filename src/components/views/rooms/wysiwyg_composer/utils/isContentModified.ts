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

import { RoomMessageEventContent, RoomMessageTextEventContent } from "matrix-js-sdk/src/types";

import EditorStateTransfer from "../../../../../utils/EditorStateTransfer";

export function isContentModified(
    newContent: RoomMessageEventContent,
    editorStateTransfer: EditorStateTransfer,
): boolean {
    // if nothing has changed then bail
    const oldContent = editorStateTransfer.getEvent().getContent<RoomMessageEventContent>();
    if (
        oldContent["msgtype"] === newContent["msgtype"] &&
        oldContent["body"] === newContent["body"] &&
        (<RoomMessageTextEventContent>oldContent)["format"] === (<RoomMessageTextEventContent>newContent)["format"] &&
        (<RoomMessageTextEventContent>oldContent)["formatted_body"] ===
            (<RoomMessageTextEventContent>newContent)["formatted_body"]
    ) {
        return false;
    }
    return true;
}
