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

import request from 'browser-request';

import { getVectorConfig } from "../../../src/vector/getconfig";

describe('getVectorConfig()', () => {
    const setRequestMockImplementationOnce = (err?: unknown, response?: { status: number }, body?: string) =>
            request.mockImplementationOnce((_opts, callback) => callback(err, response, body));

    const prevDocumentDomain = document.domain;
    const elementDomain = 'app.element.io';
    const now = 1234567890;
    const specificConfig = {
        brand: 'specific',
    }
    const generalConfig = {
        brand: 'general',
    }

    beforeEach(() => {
        document.domain = elementDomain;

        // stable value for cachebuster
        jest.spyOn(Date, 'now').mockReturnValue(now);
        jest.clearAllMocks();
    });

    afterAll(() => {
        document.domain = prevDocumentDomain;
        jest.spyOn(Date, 'now').mockRestore();
    });

    it('requests specific config for document domain', async () => {
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(specificConfig))
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        await getVectorConfig();

        expect(request.mock.calls[0][0]).toEqual({ method: "GET", url: 'config.app.element.io.json', qs: { cachebuster: now } })
    });
    
    it('adds trailing slash to relativeLocation when not an empty string', async () => {
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(specificConfig))
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        await getVectorConfig('..');

        expect(request.mock.calls[0][0]).toEqual(expect.objectContaining({ url: '../config.app.element.io.json' }))
        expect(request.mock.calls[1][0]).toEqual(expect.objectContaining({ url: '../config.json' }))
    });

    it('returns parsed specific config when it is non-empty', async () => {
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(specificConfig))
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        const result = await getVectorConfig();
        expect(result).toEqual(specificConfig);
    });

    it('returns general config when specific config succeeds but is empty', async () => {
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify({}))
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        const result = await getVectorConfig();
        expect(result).toEqual(generalConfig);
    });

    it('returns general config when specific config 404s', async () => {
        setRequestMockImplementationOnce(undefined, { status: 404 })
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        const result = await getVectorConfig();
        expect(result).toEqual(generalConfig);
    });

    it('returns general config when specific config is fetched from a file and is empty', async () => {
        setRequestMockImplementationOnce(undefined, { status: 0 }, '')
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        const result = await getVectorConfig();
        expect(result).toEqual(generalConfig);
    });

    it('returns general config when specific config returns a non-200 status', async () => {
        setRequestMockImplementationOnce(undefined, { status: 401 })
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        const result = await getVectorConfig();
        expect(result).toEqual(generalConfig);
    });

    it('returns general config when specific config returns an error', async () => {
        setRequestMockImplementationOnce('err1')
        setRequestMockImplementationOnce(undefined, { status: 200 }, JSON.stringify(generalConfig))
        
        const result = await getVectorConfig();
        expect(result).toEqual(generalConfig);
    });

    it('rejects with an error when general config rejects', async () => {
        setRequestMockImplementationOnce('err-specific');
        setRequestMockImplementationOnce('err-general');

        await expect(() => getVectorConfig()).rejects.toEqual({"err": "err-general", "response": undefined});
    });

});
