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

import { mocked } from "jest-mock";

import { ClientPrefix, MatrixHttpApi, Method, UploadResponse } from "../../../src";
import { TypedEventEmitter } from "../../../src/models/typed-event-emitter";

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

jest.useFakeTimers();

describe("MatrixHttpApi", () => {
    const baseUrl = "http://baseUrl";
    const prefix = ClientPrefix.V3;

    let xhr: Writeable<XMLHttpRequest>;
    let upload: Promise<UploadResponse>;

    const DONE = 0;

    beforeEach(() => {
        xhr = {
            upload: {} as XMLHttpRequestUpload,
            open: jest.fn(),
            send: jest.fn(),
            abort: jest.fn(),
            setRequestHeader: jest.fn(),
            onreadystatechange: undefined,
            getResponseHeader: jest.fn(),
        } as unknown as XMLHttpRequest;
        // We stub out XHR here as it is not available in JSDOM
        // @ts-ignore
        global.XMLHttpRequest = jest.fn().mockReturnValue(xhr);
        // @ts-ignore
        global.XMLHttpRequest.DONE = DONE;
    });

    afterEach(() => {
        upload?.catch(() => {});
        // Abort any remaining requests
        xhr.readyState = DONE;
        xhr.status = 0;
        // @ts-ignore
        xhr.onreadystatechange?.(new Event("test"));
    });

    it("should fall back to `fetch` where xhr is unavailable", () => {
        global.XMLHttpRequest = undefined!;
        const fetchFn = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) });
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix, fetchFn });
        upload = api.uploadContent({} as File);
        expect(fetchFn).toHaveBeenCalled();
    });

    it("should prefer xhr where available", () => {
        const fetchFn = jest.fn().mockResolvedValue({ ok: true });
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix, fetchFn });
        upload = api.uploadContent({} as File);
        expect(fetchFn).not.toHaveBeenCalled();
        expect(xhr.open).toHaveBeenCalled();
    });

    it("should send access token in query params if header disabled", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), {
            baseUrl,
            prefix,
            accessToken: "token",
            useAuthorizationHeader: false,
        });
        upload = api.uploadContent({} as File);
        expect(xhr.open).toHaveBeenCalledWith(
            Method.Post,
            baseUrl.toLowerCase() + "/_matrix/media/r0/upload?access_token=token",
        );
        expect(xhr.setRequestHeader).not.toHaveBeenCalledWith("Authorization");
    });

    it("should send access token in header by default", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), {
            baseUrl,
            prefix,
            accessToken: "token",
        });
        upload = api.uploadContent({} as File);
        expect(xhr.open).toHaveBeenCalledWith(Method.Post, baseUrl.toLowerCase() + "/_matrix/media/r0/upload");
        expect(xhr.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer token");
    });

    it("should include filename by default", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File, { name: "name" });
        expect(xhr.open).toHaveBeenCalledWith(
            Method.Post,
            baseUrl.toLowerCase() + "/_matrix/media/r0/upload?filename=name",
        );
    });

    it("should allow not sending the filename", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File, { name: "name", includeFilename: false });
        expect(xhr.open).toHaveBeenCalledWith(Method.Post, baseUrl.toLowerCase() + "/_matrix/media/r0/upload");
    });

    it("should abort xhr when the upload is aborted", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);
        api.cancelUpload(upload);
        expect(xhr.abort).toHaveBeenCalled();
        return expect(upload).rejects.toThrow("Aborted");
    });

    it("should timeout if no progress in 30s", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);
        jest.advanceTimersByTime(25000);
        // @ts-ignore
        xhr.upload.onprogress(new Event("progress", { loaded: 1, total: 100 }));
        jest.advanceTimersByTime(25000);
        expect(xhr.abort).not.toHaveBeenCalled();
        jest.advanceTimersByTime(5000);
        expect(xhr.abort).toHaveBeenCalled();
    });

    it("should call progressHandler", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        const progressHandler = jest.fn();
        upload = api.uploadContent({} as File, { progressHandler });
        const progressEvent = new Event("progress") as ProgressEvent;
        Object.assign(progressEvent, { loaded: 1, total: 100 });
        // @ts-ignore
        xhr.upload.onprogress(progressEvent);
        expect(progressHandler).toHaveBeenCalledWith({ loaded: 1, total: 100 });

        Object.assign(progressEvent, { loaded: 95, total: 100 });
        // @ts-ignore
        xhr.upload.onprogress(progressEvent);
        expect(progressHandler).toHaveBeenCalledWith({ loaded: 95, total: 100 });
    });

    it("should error when no response body", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);

        xhr.readyState = DONE;
        xhr.responseText = "";
        xhr.status = 200;
        // @ts-ignore
        xhr.onreadystatechange?.(new Event("test"));

        return expect(upload).rejects.toThrow("No response body.");
    });

    it("should error on a 400-code", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);

        xhr.readyState = DONE;
        xhr.responseText = '{"errcode": "M_NOT_FOUND", "error": "Not found"}';
        xhr.status = 404;
        mocked(xhr.getResponseHeader).mockReturnValue("application/json");
        // @ts-ignore
        xhr.onreadystatechange?.(new Event("test"));

        return expect(upload).rejects.toThrow("Not found");
    });

    it("should return response on successful upload", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);

        xhr.readyState = DONE;
        xhr.responseText = '{"content_uri": "mxc://server/foobar"}';
        xhr.status = 200;
        mocked(xhr.getResponseHeader).mockReturnValue("application/json");
        // @ts-ignore
        xhr.onreadystatechange?.(new Event("test"));

        return expect(upload).resolves.toStrictEqual({ content_uri: "mxc://server/foobar" });
    });

    it("should abort xhr when calling `cancelUpload`", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);
        expect(api.cancelUpload(upload)).toBeTruthy();
        expect(xhr.abort).toHaveBeenCalled();
    });

    it("should return false when `cancelUpload` is called but unsuccessful", async () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);

        xhr.readyState = DONE;
        xhr.status = 500;
        mocked(xhr.getResponseHeader).mockReturnValue("application/json");
        // @ts-ignore
        xhr.onreadystatechange?.(new Event("test"));
        await upload.catch(() => {});

        expect(api.cancelUpload(upload)).toBeFalsy();
        expect(xhr.abort).not.toHaveBeenCalled();
    });

    it("should return active uploads in `getCurrentUploads`", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix });
        upload = api.uploadContent({} as File);
        expect(api.getCurrentUploads().find((u) => u.promise === upload)).toBeTruthy();
        api.cancelUpload(upload);
        expect(api.getCurrentUploads().find((u) => u.promise === upload)).toBeFalsy();
    });

    it("should return expected object from `getContentUri`", () => {
        const api = new MatrixHttpApi(new TypedEventEmitter<any, any>(), { baseUrl, prefix, accessToken: "token" });
        expect(api.getContentUri()).toMatchSnapshot();
    });
});
