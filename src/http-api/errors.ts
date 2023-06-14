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

import { IUsageLimit } from "../@types/partials";
import { MatrixEvent } from "../models/event";

interface IErrorJson extends Partial<IUsageLimit> {
    [key: string]: any; // extensible
    errcode?: string;
    error?: string;
}

/**
 * Construct a generic HTTP error. This is a JavaScript Error with additional information
 * specific to HTTP responses.
 * @param msg - The error message to include.
 * @param httpStatus - The HTTP response status code.
 */
export class HTTPError extends Error {
    public constructor(msg: string, public readonly httpStatus?: number) {
        super(msg);
    }
}

export class MatrixError extends HTTPError {
    // The Matrix 'errcode' value, e.g. "M_FORBIDDEN".
    public readonly errcode?: string;
    // The raw Matrix error JSON used to construct this object.
    public data: IErrorJson;

    /**
     * Construct a Matrix error. This is a JavaScript Error with additional
     * information specific to the standard Matrix error response.
     * @param errorJson - The Matrix error JSON returned from the homeserver.
     * @param httpStatus - The numeric HTTP status code given
     */
    public constructor(
        errorJson: IErrorJson = {},
        public readonly httpStatus?: number,
        public url?: string,
        public event?: MatrixEvent,
    ) {
        let message = errorJson.error || "Unknown message";
        if (httpStatus) {
            message = `[${httpStatus}] ${message}`;
        }
        if (url) {
            message = `${message} (${url})`;
        }
        super(`MatrixError: ${message}`, httpStatus);
        this.errcode = errorJson.errcode;
        this.name = errorJson.errcode || "Unknown error code";
        this.data = errorJson;
    }
}

/**
 * Construct a ConnectionError. This is a JavaScript Error indicating
 * that a request failed because of some error with the connection, either
 * CORS was not correctly configured on the server, the server didn't response,
 * the request timed out, or the internet connection on the client side went down.
 */
export class ConnectionError extends Error {
    public constructor(message: string, cause?: Error) {
        super(message + (cause ? `: ${cause.message}` : ""));
    }

    public get name(): string {
        return "ConnectionError";
    }
}
