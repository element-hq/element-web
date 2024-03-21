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

import { ExportFormat, ExportType } from "../utils/exportUtils/exportUtils";

export type ForceChatExportParameters = {
    format?: ExportFormat;
    range?: ExportType;
    // must be < 10**8
    // only used when range is 'LastNMessages'
    // default is 100
    numberOfMessages?: number;
    includeAttachments?: boolean;
    // maximum size of exported archive
    // must be > 0 and < 8000
    sizeMb?: number;
};

/**
 * Force parameters in room chat export
 * fields returned here are forced
 * and not allowed to be edited in the chat export form
 */
const getForceChatExportParameters = (): ForceChatExportParameters => {
    return {};
};

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IChatExportCustomisations {
    getForceChatExportParameters: typeof getForceChatExportParameters;
}

// A real customisation module will define and export one or more of the
// customisation points that make up `IChatExportCustomisations`.
export default {
    getForceChatExportParameters,
} as IChatExportCustomisations;
