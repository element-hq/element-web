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

import { IdServerUnbindResult } from "./partials";

// Types relating to Synapse Admin APIs

/* eslint-disable camelcase */
export interface ISynapseAdminWhoisResponse {
    user_id: string;
    devices: {
        [deviceId: string]: {
            sessions: {
                connections: {
                    ip: string;
                    last_seen: number; // millis since epoch
                    user_agent: string;
                }[];
            }[];
        };
    };
}

export interface ISynapseAdminDeactivateResponse {
    id_server_unbind_result: IdServerUnbindResult;
}
/* eslint-enable camelcase */
