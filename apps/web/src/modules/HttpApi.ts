/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { AuthedRequestOpts, HttpApi as IHttpApi, HttpMethod } from "@element-hq/element-web-module-api";
import { type Body, Method } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";

const METHODS: Record<HttpMethod, Method> = {
    GET: Method.Get,
    POST: Method.Post,
    PUT: Method.Put,
    DELETE: Method.Delete,
};

/**
 * Sends HTTP requests to the homeserver for modules, through the HTTP API of the matrix client.
 */
export class HttpApi implements IHttpApi {
    public authedRequest<T>(method: HttpMethod, path: string, opts: AuthedRequestOpts = {}): Promise<T> {
        return MatrixClientPeg.safeGet().http.authedRequest<T>(
            METHODS[method],
            path,
            opts.queryParams,
            // The module API types the body as `unknown` so it doesn't depend on matrix-js-sdk types
            opts.body as Body | undefined,
            { prefix: opts.prefix },
        );
    }
}
