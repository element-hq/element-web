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

export enum ClientPrefix {
    /**
     * A constant representing the URI path for release 0 of the Client-Server HTTP API.
     */
    R0 = "/_matrix/client/r0",
    /**
     * A constant representing the URI path for the legacy release v1 of the Client-Server HTTP API.
     */
    V1 = "/_matrix/client/v1",
    /**
     * A constant representing the URI path for Client-Server API endpoints versioned at v3.
     */
    V3 = "/_matrix/client/v3",
    /**
     * A constant representing the URI path for as-yet unspecified Client-Server HTTP APIs.
     */
    Unstable = "/_matrix/client/unstable",
}

export enum IdentityPrefix {
    /**
     * URI path for the v2 identity API
     */
    V2 = "/_matrix/identity/v2",
}

export enum MediaPrefix {
    /**
     * URI path for the media repo API
     */
    R0 = "/_matrix/media/r0",
}
