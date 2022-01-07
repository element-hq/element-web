/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

/**
 * This is an internal module. See {@link MatrixHttpApi} for the public class.
 * @module http-api
 */

import { parse as parseContentType, ParsedMediaType } from "content-type";
import EventEmitter from "events";

import type { IncomingHttpHeaders, IncomingMessage } from "http";
import type { Request as _Request, CoreOptions } from "request";
// we use our own implementation of setTimeout, so that if we get suspended in
// the middle of a /sync, we cancel the sync as soon as we awake, rather than
// waiting for the delay to elapse.
import * as callbacks from "./realtime-callbacks";
import { IUploadOpts } from "./@types/requests";
import { IAbortablePromise, IUsageLimit } from "./@types/partials";
import { IDeferred } from "./utils";
import { Callback } from "./client";
import * as utils from "./utils";
import { logger } from './logger';

/*
TODO:
- CS: complete register function (doing stages)
- Identity server: linkEmail, authEmail, bindEmail, lookup3pid
*/

/**
 * A constant representing the URI path for release 0 of the Client-Server HTTP API.
 */
export const PREFIX_R0 = "/_matrix/client/r0";

/**
 * A constant representing the URI path for release v1 of the Client-Server HTTP API.
 */
export const PREFIX_V1 = "/_matrix/client/v1";

/**
 * A constant representing the URI path for as-yet unspecified Client-Server HTTP APIs.
 */
export const PREFIX_UNSTABLE = "/_matrix/client/unstable";

/**
 * URI path for v1 of the the identity API
 * @deprecated Use v2.
 */
export const PREFIX_IDENTITY_V1 = "/_matrix/identity/api/v1";

/**
 * URI path for the v2 identity API
 */
export const PREFIX_IDENTITY_V2 = "/_matrix/identity/v2";

/**
 * URI path for the media repo API
 */
export const PREFIX_MEDIA_R0 = "/_matrix/media/r0";

type RequestProps = "method"
    | "withCredentials"
    | "json"
    | "headers"
    | "qs"
    | "body"
    | "qsStringifyOptions"
    | "useQuerystring"
    | "timeout";

export interface IHttpOpts {
    baseUrl: string;
    idBaseUrl?: string;
    prefix: string;
    onlyData: boolean;
    accessToken?: string;
    extraParams?: Record<string, string>;
    localTimeoutMs?: number;
    useAuthorizationHeader?: boolean;
    request(opts: Pick<CoreOptions, RequestProps> & {
        uri: string;
        method: Method;
        // eslint-disable-next-line camelcase
        _matrix_opts: IHttpOpts;
    }, callback: RequestCallback): IRequest;
}

interface IRequest extends _Request {
    onprogress?(e: unknown): void;
}

interface IRequestOpts<T> {
    prefix?: string;
    localTimeoutMs?: number;
    headers?: Record<string, string>;
    json?: boolean; // defaults to true
    qsStringifyOptions?: CoreOptions["qsStringifyOptions"];
    bodyParser?(body: string): T;
}

export interface IUpload {
    loaded: number;
    total: number;
    promise: IAbortablePromise<unknown>;
}

interface IContentUri {
    base: string;
    path: string;
    params: {
        // eslint-disable-next-line camelcase
        access_token: string;
    };
}

type ResponseType<T, O extends IRequestOpts<T> | void = void> =
    O extends { bodyParser: (body: string) => T } ? T :
    O extends { json: false } ? string :
    T;

interface IUploadResponse {
    // eslint-disable-next-line camelcase
    content_uri: string;
}

// This type's defaults only work for the Browser
// in the Browser we default rawResponse = false & onlyContentUri = true
// in Node we default rawResponse = true & onlyContentUri = false
export type UploadContentResponseType<O extends IUploadOpts> =
    O extends undefined ? string :
    O extends { rawResponse: true } ? string :
    O extends { onlyContentUri: true } ? string :
    O extends { rawResponse: false } ? IUploadResponse :
    O extends { onlyContentUri: false } ? IUploadResponse :
    string;

export enum Method {
    Get = "GET",
    Put = "PUT",
    Post = "POST",
    Delete = "DELETE",
}

export type FileType = Document | XMLHttpRequestBodyInit;

/**
 * Construct a MatrixHttpApi.
 * @constructor
 * @param {EventEmitter} eventEmitter The event emitter to use for emitting events
 * @param {Object} opts The options to use for this HTTP API.
 * @param {string} opts.baseUrl Required. The base client-server URL e.g.
 * 'http://localhost:8008'.
 * @param {Function} opts.request Required. The function to call for HTTP
 * requests. This function must look like function(opts, callback){ ... }.
 * @param {string} opts.prefix Required. The matrix client prefix to use, e.g.
 * '/_matrix/client/r0'. See PREFIX_R0 and PREFIX_UNSTABLE for constants.
 *
 * @param {boolean} opts.onlyData True to return only the 'data' component of the
 * response (e.g. the parsed HTTP body). If false, requests will return an
 * object with the properties <tt>code</tt>, <tt>headers</tt> and <tt>data</tt>.
 *
 * @param {string=} opts.accessToken The access_token to send with requests. Can be
 * null to not send an access token.
 * @param {Object=} opts.extraParams Optional. Extra query parameters to send on
 * requests.
 * @param {Number=} opts.localTimeoutMs The default maximum amount of time to wait
 * before timing out the request. If not specified, there is no timeout.
 * @param {boolean} [opts.useAuthorizationHeader = false] Set to true to use
 * Authorization header instead of query param to send the access token to the server.
 */
export class MatrixHttpApi {
    private uploads: IUpload[] = [];

    constructor(private eventEmitter: EventEmitter, public readonly opts: IHttpOpts) {
        utils.checkObjectHasKeys(opts, ["baseUrl", "request", "prefix"]);
        opts.onlyData = !!opts.onlyData;
        opts.useAuthorizationHeader = !!opts.useAuthorizationHeader;
    }

    /**
     * Sets the base URL for the identity server
     * @param {string} url The new base url
     */
    public setIdBaseUrl(url: string): void {
        this.opts.idBaseUrl = url;
    }

    /**
     * Get the content repository url with query parameters.
     * @return {Object} An object with a 'base', 'path' and 'params' for base URL,
     *          path and query parameters respectively.
     */
    public getContentUri(): IContentUri {
        return {
            base: this.opts.baseUrl,
            path: "/_matrix/media/r0/upload",
            params: {
                access_token: this.opts.accessToken,
            },
        };
    }

    /**
     * Upload content to the homeserver
     *
     * @param {object} file The object to upload. On a browser, something that
     *   can be sent to XMLHttpRequest.send (typically a File).  Under node.js,
     *   a Buffer, String or ReadStream.
     *
     * @param {object} opts  options object
     *
     * @param {string=} opts.name   Name to give the file on the server. Defaults
     *   to <tt>file.name</tt>.
     *
     * @param {boolean=} opts.includeFilename if false will not send the filename,
     *   e.g for encrypted file uploads where filename leaks are undesirable.
     *   Defaults to true.
     *
     * @param {string=} opts.type   Content-type for the upload. Defaults to
     *   <tt>file.type</tt>, or <tt>applicaton/octet-stream</tt>.
     *
     * @param {boolean=} opts.rawResponse Return the raw body, rather than
     *   parsing the JSON. Defaults to false (except on node.js, where it
     *   defaults to true for backwards compatibility).
     *
     * @param {boolean=} opts.onlyContentUri Just return the content URI,
     *   rather than the whole body. Defaults to false (except on browsers,
     *   where it defaults to true for backwards compatibility). Ignored if
     *   opts.rawResponse is true.
     *
     * @param {Function=} opts.callback Deprecated. Optional. The callback to
     *    invoke on success/failure. See the promise return values for more
     *    information.
     *
     * @param {Function=} opts.progressHandler Optional. Called when a chunk of
     *    data has been uploaded, with an object containing the fields `loaded`
     *    (number of bytes transferred) and `total` (total size, if known).
     *
     * @return {Promise} Resolves to response object, as
     *    determined by this.opts.onlyData, opts.rawResponse, and
     *    opts.onlyContentUri.  Rejects with an error (usually a MatrixError).
     */
    public uploadContent<O extends IUploadOpts>(
        file: FileType,
        opts?: O,
    ): IAbortablePromise<UploadContentResponseType<O>> {
        if (utils.isFunction(opts)) {
            // opts used to be callback, backwards compatibility
            opts = {
                callback: opts as unknown as IUploadOpts["callback"],
            } as O;
        } else if (!opts) {
            opts = {} as O;
        }

        // default opts.includeFilename to true (ignoring falsey values)
        const includeFilename = opts.includeFilename !== false;

        // if the file doesn't have a mime type, use a default since
        // the HS errors if we don't supply one.
        const contentType = opts.type || (file as File).type || 'application/octet-stream';
        const fileName = opts.name || (file as File).name;

        // We used to recommend setting file.stream to the thing to upload on
        // Node.js. As of 2019-06-11, this is still in widespread use in various
        // clients, so we should preserve this for simple objects used in
        // Node.js. File API objects (via either the File or Blob interfaces) in
        // the browser now define a `stream` method, which leads to trouble
        // here, so we also check the type of `stream`.
        let body = file;
        const bodyStream = (body as File | Blob).stream; // this type is wrong but for legacy reasons is good enough
        if (bodyStream && typeof bodyStream !== "function") {
            logger.warn(
                "Using `file.stream` as the content to upload. Future " +
                "versions of the js-sdk will change this to expect `file` to " +
                "be the content directly.",
            );
            body = bodyStream;
        }

        // backwards-compatibility hacks where we used to do different things
        // between browser and node.
        let rawResponse = opts.rawResponse;
        if (rawResponse === undefined) {
            if (global.XMLHttpRequest) {
                rawResponse = false;
            } else {
                logger.warn(
                    "Returning the raw JSON from uploadContent(). Future " +
                    "versions of the js-sdk will change this default, to " +
                    "return the parsed object. Set opts.rawResponse=false " +
                    "to change this behaviour now.",
                );
                rawResponse = true;
            }
        }

        let onlyContentUri = opts.onlyContentUri;
        if (!rawResponse && onlyContentUri === undefined) {
            if (global.XMLHttpRequest) {
                logger.warn(
                    "Returning only the content-uri from uploadContent(). " +
                    "Future versions of the js-sdk will change this " +
                    "default, to return the whole response object. Set " +
                    "opts.onlyContentUri=false to change this behaviour now.",
                );
                onlyContentUri = true;
            } else {
                onlyContentUri = false;
            }
        }

        // browser-request doesn't support File objects because it deep-copies
        // the options using JSON.parse(JSON.stringify(options)). Instead of
        // loading the whole file into memory as a string and letting
        // browser-request base64 encode and then decode it again, we just
        // use XMLHttpRequest directly.
        // (browser-request doesn't support progress either, which is also kind
        // of important here)

        const upload = { loaded: 0, total: 0 } as IUpload;
        let promise: IAbortablePromise<UploadContentResponseType<O>>;

        // XMLHttpRequest doesn't parse JSON for us. request normally does, but
        // we're setting opts.json=false so that it doesn't JSON-encode the
        // request, which also means it doesn't JSON-decode the response. Either
        // way, we have to JSON-parse the response ourselves.
        let bodyParser = null;
        if (!rawResponse) {
            bodyParser = function(rawBody: string) {
                let body = JSON.parse(rawBody);
                if (onlyContentUri) {
                    body = body.content_uri;
                    if (body === undefined) {
                        throw Error('Bad response');
                    }
                }
                return body;
            };
        }

        if (global.XMLHttpRequest) {
            const defer = utils.defer<UploadContentResponseType<O>>();
            const xhr = new global.XMLHttpRequest();
            const cb = requestCallback(defer, opts.callback, this.opts.onlyData);

            const timeoutFn = function() {
                xhr.abort();
                cb(new Error('Timeout'));
            };

            // set an initial timeout of 30s; we'll advance it each time we get a progress notification
            let timeoutTimer = callbacks.setTimeout(timeoutFn, 30000);

            xhr.onreadystatechange = function() {
                let resp: string;
                switch (xhr.readyState) {
                    case global.XMLHttpRequest.DONE:
                        callbacks.clearTimeout(timeoutTimer);
                        try {
                            if (xhr.status === 0) {
                                throw new AbortError();
                            }
                            if (!xhr.responseText) {
                                throw new Error('No response body.');
                            }
                            resp = xhr.responseText;
                            if (bodyParser) {
                                resp = bodyParser(resp);
                            }
                        } catch (err) {
                            err.http_status = xhr.status;
                            cb(err);
                            return;
                        }
                        cb(undefined, xhr, resp);
                        break;
                }
            };
            xhr.upload.addEventListener("progress", function(ev) {
                callbacks.clearTimeout(timeoutTimer);
                upload.loaded = ev.loaded;
                upload.total = ev.total;
                timeoutTimer = callbacks.setTimeout(timeoutFn, 30000);
                if (opts.progressHandler) {
                    opts.progressHandler({
                        loaded: ev.loaded,
                        total: ev.total,
                    });
                }
            });
            let url = this.opts.baseUrl + "/_matrix/media/r0/upload";

            const queryArgs = [];

            if (includeFilename && fileName) {
                queryArgs.push("filename=" + encodeURIComponent(fileName));
            }

            if (!this.opts.useAuthorizationHeader) {
                queryArgs.push("access_token=" + encodeURIComponent(this.opts.accessToken));
            }

            if (queryArgs.length > 0) {
                url += "?" + queryArgs.join("&");
            }

            xhr.open("POST", url);
            if (this.opts.useAuthorizationHeader) {
                xhr.setRequestHeader("Authorization", "Bearer " + this.opts.accessToken);
            }
            xhr.setRequestHeader("Content-Type", contentType);
            xhr.send(body);
            promise = defer.promise as IAbortablePromise<UploadContentResponseType<O>>;

            // dirty hack (as per doRequest) to allow the upload to be cancelled.
            promise.abort = xhr.abort.bind(xhr);
        } else {
            const queryParams: Record<string, string> = {};

            if (includeFilename && fileName) {
                queryParams.filename = fileName;
            }

            promise = this.authedRequest(
                opts.callback, Method.Post, "/upload", queryParams, body, {
                    prefix: "/_matrix/media/r0",
                    headers: { "Content-Type": contentType },
                    json: false,
                    bodyParser,
                },
            );
        }

        // remove the upload from the list on completion
        upload.promise = promise.finally(() => {
            for (let i = 0; i < this.uploads.length; ++i) {
                if (this.uploads[i] === upload) {
                    this.uploads.splice(i, 1);
                    return;
                }
            }
        }) as IAbortablePromise<UploadContentResponseType<O>>;

        // copy our dirty abort() method to the new promise
        upload.promise.abort = promise.abort;
        this.uploads.push(upload);

        return upload.promise as IAbortablePromise<UploadContentResponseType<O>>;
    }

    public cancelUpload(promise: IAbortablePromise<unknown>): boolean {
        if (promise.abort) {
            promise.abort();
            return true;
        }
        return false;
    }

    public getCurrentUploads(): IUpload[] {
        return this.uploads;
    }

    public idServerRequest<T>(
        callback: Callback<T>,
        method: Method,
        path: string,
        params: Record<string, string | string[]>,
        prefix: string,
        accessToken: string,
    ): Promise<T> {
        if (!this.opts.idBaseUrl) {
            throw new Error("No identity server base URL set");
        }

        const fullUri = this.opts.idBaseUrl + prefix + path;

        if (callback !== undefined && !utils.isFunction(callback)) {
            throw Error(
                "Expected callback to be a function but got " + typeof callback,
            );
        }

        const opts = {
            uri: fullUri,
            method,
            withCredentials: false,
            json: true, // we want a JSON response if we can
            _matrix_opts: this.opts,
            headers: {},
        } as Parameters<IHttpOpts["request"]>[0];

        if (method === Method.Get) {
            opts.qs = params;
        } else if (typeof params === "object") {
            opts.json = !!params; // XXX: this feels strange
        }

        if (accessToken) {
            opts.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const defer = utils.defer<T>();
        this.opts.request(opts, requestCallback(defer, callback, this.opts.onlyData));
        return defer.promise;
    }

    /**
     * Perform an authorised request to the homeserver.
     * @param {Function} callback Optional. The callback to invoke on
     * success/failure. See the promise return values for more information.
     * @param {string} method The HTTP method e.g. "GET".
     * @param {string} path The HTTP path <b>after</b> the supplied prefix e.g.
     * "/createRoom".
     *
     * @param {Object=} queryParams A dict of query params (these will NOT be
     * urlencoded). If unspecified, there will be no query params.
     *
     * @param {Object} [data] The HTTP JSON body.
     *
     * @param {Object|Number=} opts additional options. If a number is specified,
     * this is treated as `opts.localTimeoutMs`.
     *
     * @param {Number=} opts.localTimeoutMs The maximum amount of time to wait before
     * timing out the request. If not specified, there is no timeout.
     *
     * @param {string=} opts.prefix The full prefix to use e.g.
     * "/_matrix/client/v2_alpha". If not specified, uses this.opts.prefix.
     *
     * @param {Object=} opts.headers map of additional request headers
     *
     * @return {Promise} Resolves to <code>{data: {Object},
     * headers: {Object}, code: {Number}}</code>.
     * If <code>onlyData</code> is set, this will resolve to the <code>data</code>
     * object only.
     * @return {module:http-api.MatrixError} Rejects with an error if a problem
     * occurred. This includes network problems and Matrix-specific error JSON.
     */
    public authedRequest<T, O extends IRequestOpts<T> = IRequestOpts<T>>(
        callback: Callback<T>,
        method: Method,
        path: string,
        queryParams?: Record<string, string | string[]>,
        data?: CoreOptions["body"],
        opts?: O | number, // number is legacy
    ): IAbortablePromise<ResponseType<T, O>> {
        if (!queryParams) queryParams = {};
        let requestOpts = (opts || {}) as O;

        if (this.opts.useAuthorizationHeader) {
            if (isFinite(opts as number)) {
                // opts used to be localTimeoutMs
                requestOpts = {
                    localTimeoutMs: opts as number,
                } as O;
            }

            if (!requestOpts.headers) {
                requestOpts.headers = {};
            }
            if (!requestOpts.headers.Authorization) {
                requestOpts.headers.Authorization = "Bearer " + this.opts.accessToken;
            }
            if (queryParams.access_token) {
                delete queryParams.access_token;
            }
        } else if (!queryParams.access_token) {
            queryParams.access_token = this.opts.accessToken;
        }

        const requestPromise = this.request<T, O>(callback, method, path, queryParams, data, requestOpts);

        requestPromise.catch((err: MatrixError) => {
            if (err.errcode == 'M_UNKNOWN_TOKEN') {
                this.eventEmitter.emit("Session.logged_out", err);
            } else if (err.errcode == 'M_CONSENT_NOT_GIVEN') {
                this.eventEmitter.emit(
                    "no_consent",
                    err.message,
                    err.data.consent_uri,
                );
            }
        });

        // return the original promise, otherwise tests break due to it having to
        // go around the event loop one more time to process the result of the request
        return requestPromise;
    }

    /**
     * Perform a request to the homeserver without any credentials.
     * @param {Function} callback Optional. The callback to invoke on
     * success/failure. See the promise return values for more information.
     * @param {string} method The HTTP method e.g. "GET".
     * @param {string} path The HTTP path <b>after</b> the supplied prefix e.g.
     * "/createRoom".
     *
     * @param {Object=} queryParams A dict of query params (these will NOT be
     * urlencoded). If unspecified, there will be no query params.
     *
     * @param {Object} [data] The HTTP JSON body.
     *
     * @param {Object=} opts additional options
     *
     * @param {Number=} opts.localTimeoutMs The maximum amount of time to wait before
     * timing out the request. If not specified, there is no timeout.
     *
     * @param {string=} opts.prefix The full prefix to use e.g.
     * "/_matrix/client/v2_alpha". If not specified, uses this.opts.prefix.
     *
     * @param {Object=} opts.headers map of additional request headers
     *
     * @return {Promise} Resolves to <code>{data: {Object},
     * headers: {Object}, code: {Number}}</code>.
     * If <code>onlyData</code> is set, this will resolve to the <code>data</code>
     * object only.
     * @return {module:http-api.MatrixError} Rejects with an error if a problem
     * occurred. This includes network problems and Matrix-specific error JSON.
     */
    public request<T, O extends IRequestOpts<T> = IRequestOpts<T>>(
        callback: Callback<T>,
        method: Method,
        path: string,
        queryParams?: CoreOptions["qs"],
        data?: CoreOptions["body"],
        opts?: O,
    ): IAbortablePromise<ResponseType<T, O>> {
        const prefix = opts?.prefix ?? this.opts.prefix;
        const fullUri = this.opts.baseUrl + prefix + path;

        return this.requestOtherUrl<T, O>(callback, method, fullUri, queryParams, data, opts);
    }

    /**
     * Perform a request to an arbitrary URL.
     * @param {Function} callback Optional. The callback to invoke on
     * success/failure. See the promise return values for more information.
     * @param {string} method The HTTP method e.g. "GET".
     * @param {string} uri The HTTP URI
     *
     * @param {Object=} queryParams A dict of query params (these will NOT be
     * urlencoded). If unspecified, there will be no query params.
     *
     * @param {Object} [data] The HTTP JSON body.
     *
     * @param {Object=} opts additional options
     *
     * @param {Number=} opts.localTimeoutMs The maximum amount of time to wait before
     * timing out the request. If not specified, there is no timeout.
     *
     * @param {string=} opts.prefix The full prefix to use e.g.
     * "/_matrix/client/v2_alpha". If not specified, uses this.opts.prefix.
     *
     * @param {Object=} opts.headers map of additional request headers
     *
     * @return {Promise} Resolves to <code>{data: {Object},
     * headers: {Object}, code: {Number}}</code>.
     * If <code>onlyData</code> is set, this will resolve to the <code>data</code>
     * object only.
     * @return {module:http-api.MatrixError} Rejects with an error if a problem
     * occurred. This includes network problems and Matrix-specific error JSON.
     */
    public requestOtherUrl<T, O extends IRequestOpts<T> = IRequestOpts<T>>(
        callback: Callback<T>,
        method: Method,
        uri: string,
        queryParams?: CoreOptions["qs"],
        data?: CoreOptions["body"],
        opts?: O | number, // number is legacy
    ): IAbortablePromise<ResponseType<T, O>> {
        let requestOpts = (opts || {}) as O;
        if (isFinite(opts as number)) {
            // opts used to be localTimeoutMs
            requestOpts = {
                localTimeoutMs: opts as number,
            } as O;
        }

        return this.doRequest<T, O>(callback, method, uri, queryParams, data, requestOpts);
    }

    /**
     * Form and return a homeserver request URL based on the given path
     * params and prefix.
     * @param {string} path The HTTP path <b>after</b> the supplied prefix e.g.
     * "/createRoom".
     * @param {Object} queryParams A dict of query params (these will NOT be
     * urlencoded).
     * @param {string} prefix The full prefix to use e.g.
     * "/_matrix/client/v2_alpha".
     * @return {string} URL
     */
    public getUrl(path: string, queryParams: CoreOptions["qs"], prefix: string): string {
        let queryString = "";
        if (queryParams) {
            queryString = "?" + utils.encodeParams(queryParams);
        }
        return this.opts.baseUrl + prefix + path + queryString;
    }

    /**
     * @private
     *
     * @param {function} callback
     * @param {string} method
     * @param {string} uri
     * @param {object} queryParams
     * @param {object|string} data
     * @param {object=} opts
     *
     * @param {boolean} [opts.json =true] Json-encode data before sending, and
     *   decode response on receipt. (We will still json-decode error
     *   responses, even if this is false.)
     *
     * @param {object=} opts.headers  extra request headers
     *
     * @param {number=} opts.localTimeoutMs client-side timeout for the
     *    request. Default timeout if falsy.
     *
     * @param {function=} opts.bodyParser function to parse the body of the
     *    response before passing it to the promise and callback.
     *
     * @return {Promise} a promise which resolves to either the
     * response object (if this.opts.onlyData is truthy), or the parsed
     * body. Rejects
     *
     * Generic T is the callback/promise resolve type
     * Generic O should be inferred
     */
    private doRequest<T, O extends IRequestOpts<T> = IRequestOpts<T>>(
        callback: Callback<T>,
        method: Method,
        uri: string,
        queryParams?: Record<string, string>,
        data?: CoreOptions["body"],
        opts?: O,
    ): IAbortablePromise<ResponseType<T, O>> {
        if (callback !== undefined && !utils.isFunction(callback)) {
            throw Error("Expected callback to be a function but got " + typeof callback);
        }

        if (this.opts.extraParams) {
            queryParams = {
                ...(queryParams || {}),
                ...this.opts.extraParams,
            };
        }

        const headers = Object.assign({}, opts.headers || {});
        if (!opts) opts = {} as O;
        const json = opts.json ?? true;
        let bodyParser = opts.bodyParser;

        // we handle the json encoding/decoding here, because request and
        // browser-request make a mess of it. Specifically, they attempt to
        // json-decode plain-text error responses, which in turn means that the
        // actual error gets swallowed by a SyntaxError.

        if (json) {
            if (data) {
                data = JSON.stringify(data);
                headers['content-type'] = 'application/json';
            }

            if (!headers['accept']) {
                headers['accept'] = 'application/json';
            }

            if (bodyParser === undefined) {
                bodyParser = function(rawBody: string) {
                    return JSON.parse(rawBody);
                };
            }
        }

        const defer = utils.defer<T>();

        let timeoutId: number;
        let timedOut = false;
        let req: IRequest;
        const localTimeoutMs = opts.localTimeoutMs || this.opts.localTimeoutMs;

        const resetTimeout = () => {
            if (localTimeoutMs) {
                if (timeoutId) {
                    callbacks.clearTimeout(timeoutId);
                }
                timeoutId = callbacks.setTimeout(function() {
                    timedOut = true;
                    req?.abort?.();
                    defer.reject(new MatrixError({
                        error: "Locally timed out waiting for a response",
                        errcode: "ORG.MATRIX.JSSDK_TIMEOUT",
                        timeout: localTimeoutMs,
                    }));
                }, localTimeoutMs);
            }
        };
        resetTimeout();

        const reqPromise = defer.promise as IAbortablePromise<ResponseType<T, O>>;

        try {
            req = this.opts.request(
                {
                    uri: uri,
                    method: method,
                    withCredentials: false,
                    qs: queryParams,
                    qsStringifyOptions: opts.qsStringifyOptions,
                    useQuerystring: true,
                    body: data,
                    json: false,
                    timeout: localTimeoutMs,
                    headers: headers || {},
                    _matrix_opts: this.opts,
                },
                (err, response, body) => {
                    if (localTimeoutMs) {
                        callbacks.clearTimeout(timeoutId);
                        if (timedOut) {
                            return; // already rejected promise
                        }
                    }

                    const handlerFn = requestCallback(defer, callback, this.opts.onlyData, bodyParser);
                    handlerFn(err, response, body);
                },
            );
            if (req) {
                // This will only work in a browser, where opts.request is the
                // `browser-request` import. Currently, `request` does not support progress
                // updates - see https://github.com/request/request/pull/2346.
                // `browser-request` returns an XHRHttpRequest which exposes `onprogress`
                if ('onprogress' in req) {
                    req.onprogress = (e) => {
                        // Prevent the timeout from rejecting the deferred promise if progress is
                        // seen with the request
                        resetTimeout();
                    };
                }

                // FIXME: This is EVIL, but I can't think of a better way to expose
                // abort() operations on underlying HTTP requests :(
                if (req.abort) {
                    reqPromise.abort = req.abort.bind(req);
                }
            }
        } catch (ex) {
            defer.reject(ex);
            if (callback) {
                callback(ex);
            }
        }
        return reqPromise;
    }
}

type RequestCallback = (err?: Error, response?: XMLHttpRequest | IncomingMessage, body?: string) => void;

// if using onlyData=false then wrap your expected data type in this generic
export interface IResponse<T> {
    code: number;
    data: T;
    headers?: IncomingHttpHeaders;
}

function getStatusCode(response: XMLHttpRequest | IncomingMessage): number {
    return (response as XMLHttpRequest).status || (response as IncomingMessage).statusCode;
}

/*
 * Returns a callback that can be invoked by an HTTP request on completion,
 * that will either resolve or reject the given defer as well as invoke the
 * given userDefinedCallback (if any).
 *
 * HTTP errors are transformed into javascript errors and the deferred is rejected.
 *
 * If bodyParser is given, it is used to transform the body of the successful
 * responses before passing to the defer/callback.
 *
 * If onlyData is true, the defer/callback is invoked with the body of the
 * response, otherwise the result object (with `code` and `data` fields)
 *
 */
function requestCallback<T>(
    defer: IDeferred<T>,
    userDefinedCallback?: Callback<T>,
    onlyData = false,
    bodyParser?: (body: string) => T,
): RequestCallback {
    return function(err: Error, response: XMLHttpRequest | IncomingMessage, body: string): void {
        if (err) {
            // the unit tests use matrix-mock-request, which throw the string "aborted" when aborting a request.
            // See https://github.com/matrix-org/matrix-mock-request/blob/3276d0263a561b5b8326b47bae720578a2c7473a/src/index.js#L48
            const aborted = err.name === "AbortError" || (err as any as string) === "aborted";
            if (!aborted && !(err instanceof MatrixError)) {
                // browser-request just throws normal Error objects,
                // not `TypeError`s like fetch does. So just assume any
                // error is due to the connection.
                err = new ConnectionError("request failed", err);
            }
        }

        let data: T | string = body;

        if (!err) {
            try {
                if (getStatusCode(response) >= 400) {
                    err = parseErrorResponse(response, body);
                } else if (bodyParser) {
                    data = bodyParser(body);
                }
            } catch (e) {
                err = new Error(`Error parsing server response: ${e}`);
            }
        }

        if (err) {
            defer.reject(err);
            userDefinedCallback?.(err);
        } else if (onlyData) {
            defer.resolve(data as T);
            userDefinedCallback?.(null, data as T);
        } else {
            const res: IResponse<T> = {
                code: getStatusCode(response),

                // XXX: why do we bother with this? it doesn't work for
                // XMLHttpRequest, so clearly we don't use it.
                headers: (response as IncomingMessage).headers,
                data: data as T,
            };
            // XXX: the variations in caller-expected types here are horrible,
            // typescript doesn't do conditional types based on runtime values
            defer.resolve(res as any as T);
            userDefinedCallback?.(null, res as any as T);
        }
    };
}

/**
 * Attempt to turn an HTTP error response into a Javascript Error.
 *
 * If it is a JSON response, we will parse it into a MatrixError. Otherwise
 * we return a generic Error.
 *
 * @param {XMLHttpRequest|http.IncomingMessage} response response object
 * @param {String} body raw body of the response
 * @returns {Error}
 */
function parseErrorResponse(response: XMLHttpRequest | IncomingMessage, body?: string) {
    const httpStatus = getStatusCode(response);
    const contentType = getResponseContentType(response);

    let err;
    if (contentType) {
        if (contentType.type === 'application/json') {
            const jsonBody = typeof(body) === 'object' ? body : JSON.parse(body);
            err = new MatrixError(jsonBody);
        } else if (contentType.type === 'text/plain') {
            err = new Error(`Server returned ${httpStatus} error: ${body}`);
        }
    }

    if (!err) {
        err = new Error(`Server returned ${httpStatus} error`);
    }
    err.httpStatus = httpStatus;
    return err;
}

/**
 * extract the Content-Type header from the response object, and
 * parse it to a `{type, parameters}` object.
 *
 * returns null if no content-type header could be found.
 *
 * @param {XMLHttpRequest|http.IncomingMessage} response response object
 * @returns {{type: String, parameters: Object}?} parsed content-type header, or null if not found
 */
function getResponseContentType(response: XMLHttpRequest | IncomingMessage): ParsedMediaType {
    let contentType;
    if ((response as XMLHttpRequest).getResponseHeader) {
        // XMLHttpRequest provides getResponseHeader
        contentType = (response as XMLHttpRequest).getResponseHeader("Content-Type");
    } else if ((response as IncomingMessage).headers) {
        // request provides http.IncomingMessage which has a message.headers map
        contentType = (response as IncomingMessage).headers['content-type'] || null;
    }

    if (!contentType) {
        return null;
    }

    try {
        return parseContentType(contentType);
    } catch (e) {
        throw new Error(`Error parsing Content-Type '${contentType}': ${e}`);
    }
}

interface IErrorJson extends Partial<IUsageLimit> {
    [key: string]: any; // extensible
    errcode?: string;
    error?: string;
}

/**
 * Construct a Matrix error. This is a JavaScript Error with additional
 * information specific to the standard Matrix error response.
 * @constructor
 * @param {Object} errorJson The Matrix error JSON returned from the homeserver.
 * @prop {string} errcode The Matrix 'errcode' value, e.g. "M_FORBIDDEN".
 * @prop {string} name Same as MatrixError.errcode but with a default unknown string.
 * @prop {string} message The Matrix 'error' value, e.g. "Missing token."
 * @prop {Object} data The raw Matrix error JSON used to construct this object.
 * @prop {integer} httpStatus The numeric HTTP status code given
 */
export class MatrixError extends Error {
    public readonly errcode: string;
    public readonly data: IErrorJson;
    public httpStatus?: number; // set by http-api

    constructor(errorJson: IErrorJson = {}) {
        super(`MatrixError: ${errorJson.errcode}`);
        this.errcode = errorJson.errcode;
        this.name = errorJson.errcode || "Unknown error code";
        this.message = errorJson.error || "Unknown message";
        this.data = errorJson;
    }
}

/**
 * Construct a ConnectionError. This is a JavaScript Error indicating
 * that a request failed because of some error with the connection, either
 * CORS was not correctly configured on the server, the server didn't response,
 * the request timed out, or the internet connection on the client side went down.
 * @constructor
 */
export class ConnectionError extends Error {
    constructor(message: string, private readonly cause: Error = undefined) {
        super(message + (cause ? `: ${cause.message}` : ""));
    }

    get name() {
        return "ConnectionError";
    }
}

export class AbortError extends Error {
    constructor() {
        super("Operation aborted");
    }

    get name() {
        return "AbortError";
    }
}

/**
 * Retries a network operation run in a callback.
 * @param  {number}   maxAttempts maximum attempts to try
 * @param  {Function} callback    callback that returns a promise of the network operation. If rejected with ConnectionError, it will be retried by calling the callback again.
 * @return {any} the result of the network operation
 * @throws {ConnectionError} If after maxAttempts the callback still throws ConnectionError
 */
export async function retryNetworkOperation<T>(maxAttempts: number, callback: () => T): Promise<T> {
    let attempts = 0;
    let lastConnectionError = null;
    while (attempts < maxAttempts) {
        try {
            if (attempts > 0) {
                const timeout = 1000 * Math.pow(2, attempts);
                logger.log(`network operation failed ${attempts} times,` +
                    ` retrying in ${timeout}ms...`);
                await new Promise(r => setTimeout(r, timeout));
            }
            return await callback();
        } catch (err) {
            if (err instanceof ConnectionError) {
                attempts += 1;
                lastConnectionError = err;
            } else {
                throw err;
            }
        }
    }
    throw lastConnectionError;
}
