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

import { FetchHttpApi } from "./fetch";
import { FileType, IContentUri, IHttpOpts, Upload, UploadOpts, UploadResponse } from "./interface";
import { MediaPrefix } from "./prefix";
import { defer, QueryDict, removeElement } from "../utils";
import * as callbacks from "../realtime-callbacks";
import { Method } from "./method";
import { ConnectionError } from "./errors";
import { parseErrorResponse } from "./utils";

export * from "./interface";
export * from "./prefix";
export * from "./errors";
export * from "./method";
export * from "./utils";

export class MatrixHttpApi<O extends IHttpOpts> extends FetchHttpApi<O> {
    private uploads: Upload[] = [];

    /**
     * Upload content to the homeserver
     *
     * @param file - The object to upload. On a browser, something that
     *   can be sent to XMLHttpRequest.send (typically a File).  Under node.js,
     *   a Buffer, String or ReadStream.
     *
     * @param opts - options object
     *
     * @returns Promise which resolves to response object, as
     *    determined by this.opts.onlyData, opts.rawResponse, and
     *    opts.onlyContentUri.  Rejects with an error (usually a MatrixError).
     */
    public uploadContent(file: FileType, opts: UploadOpts = {}): Promise<UploadResponse> {
        const includeFilename = opts.includeFilename ?? true;
        const abortController = opts.abortController ?? new AbortController();

        // If the file doesn't have a mime type, use a default since the HS errors if we don't supply one.
        const contentType = opts.type ?? (file as File).type ?? "application/octet-stream";
        const fileName = opts.name ?? (file as File).name;

        const upload = {
            loaded: 0,
            total: 0,
            abortController,
        } as Upload;
        const deferred = defer<UploadResponse>();

        if (global.XMLHttpRequest) {
            const xhr = new global.XMLHttpRequest();

            const timeoutFn = function (): void {
                xhr.abort();
                deferred.reject(new Error("Timeout"));
            };

            // set an initial timeout of 30s; we'll advance it each time we get a progress notification
            let timeoutTimer = callbacks.setTimeout(timeoutFn, 30000);

            xhr.onreadystatechange = function (): void {
                switch (xhr.readyState) {
                    case global.XMLHttpRequest.DONE:
                        callbacks.clearTimeout(timeoutTimer);
                        try {
                            if (xhr.status === 0) {
                                throw new DOMException(xhr.statusText, "AbortError"); // mimic fetch API
                            }
                            if (!xhr.responseText) {
                                throw new Error("No response body.");
                            }

                            if (xhr.status >= 400) {
                                deferred.reject(parseErrorResponse(xhr, xhr.responseText));
                            } else {
                                deferred.resolve(JSON.parse(xhr.responseText));
                            }
                        } catch (err) {
                            if ((<Error>err).name === "AbortError") {
                                deferred.reject(err);
                                return;
                            }
                            deferred.reject(new ConnectionError("request failed", <Error>err));
                        }
                        break;
                }
            };

            xhr.upload.onprogress = (ev: ProgressEvent): void => {
                callbacks.clearTimeout(timeoutTimer);
                upload.loaded = ev.loaded;
                upload.total = ev.total;
                timeoutTimer = callbacks.setTimeout(timeoutFn, 30000);
                opts.progressHandler?.({
                    loaded: ev.loaded,
                    total: ev.total,
                });
            };

            const url = this.getUrl("/upload", undefined, MediaPrefix.R0);

            if (includeFilename && fileName) {
                url.searchParams.set("filename", encodeURIComponent(fileName));
            }

            if (!this.opts.useAuthorizationHeader && this.opts.accessToken) {
                url.searchParams.set("access_token", encodeURIComponent(this.opts.accessToken));
            }

            xhr.open(Method.Post, url.href);
            if (this.opts.useAuthorizationHeader && this.opts.accessToken) {
                xhr.setRequestHeader("Authorization", "Bearer " + this.opts.accessToken);
            }
            xhr.setRequestHeader("Content-Type", contentType);
            xhr.send(file);

            abortController.signal.addEventListener("abort", () => {
                xhr.abort();
            });
        } else {
            const queryParams: QueryDict = {};
            if (includeFilename && fileName) {
                queryParams.filename = fileName;
            }

            const headers: Record<string, string> = { "Content-Type": contentType };

            this.authedRequest<UploadResponse>(Method.Post, "/upload", queryParams, file, {
                prefix: MediaPrefix.R0,
                headers,
                abortSignal: abortController.signal,
            })
                .then((response) => {
                    return this.opts.onlyData ? <UploadResponse>response : response.json();
                })
                .then(deferred.resolve, deferred.reject);
        }

        // remove the upload from the list on completion
        upload.promise = deferred.promise.finally(() => {
            removeElement(this.uploads, (elem) => elem === upload);
        });
        abortController.signal.addEventListener("abort", () => {
            removeElement(this.uploads, (elem) => elem === upload);
            deferred.reject(new DOMException("Aborted", "AbortError"));
        });
        this.uploads.push(upload);
        return upload.promise;
    }

    public cancelUpload(promise: Promise<UploadResponse>): boolean {
        const upload = this.uploads.find((u) => u.promise === promise);
        if (upload) {
            upload.abortController.abort();
            return true;
        }
        return false;
    }

    public getCurrentUploads(): Upload[] {
        return this.uploads;
    }

    /**
     * Get the content repository url with query parameters.
     * @returns An object with a 'base', 'path' and 'params' for base URL,
     *          path and query parameters respectively.
     */
    public getContentUri(): IContentUri {
        return {
            base: this.opts.baseUrl,
            path: MediaPrefix.R0 + "/upload",
            params: {
                access_token: this.opts.accessToken!,
            },
        };
    }
}
