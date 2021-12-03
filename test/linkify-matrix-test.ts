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
import { linkify } from '../src/linkify-matrix';

describe('linkify-matrix', () => {
    describe('roomalias', () => {
        it('properly parses #_foonetic_xkcd:matrix.org', () => {
            const test = '#_foonetic_xkcd:matrix.org';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#_foonetic_xkcd:matrix.org",
                type: "roomalias",
                value: "#_foonetic_xkcd:matrix.org",
            }]));
        });
        it('properly parses #foo:localhost', () => {
            const test = "#foo:localhost";
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:localhost",
                type: "roomalias",
                value: "#foo:localhost",
            }]));
        });
        it('accept #foo:bar.com', () => {
            const test = '#foo:bar.com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:bar.com",
                type: "roomalias",
                value: "#foo:bar.com",
            }]));
        });
        it('accept #foo:com (mostly for (TLD|DOMAIN)+ mixing)', () => {
            const test = '#foo:com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:com",
                type: "roomalias",
                value: "#foo:com",
            }]));
        });
        it('accept repeated TLDs (e.g .org.uk)', () => {
            const test = '#foo:bar.org.uk';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:bar.org.uk",
                type: "roomalias",
                value: "#foo:bar.org.uk",
            }]));
        });
        it('ignores trailing `:`', () => {
            const test = '#foo:bar.com:';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:bar.com",
                type: "roomalias",
                value: "#foo:bar.com",
            }]));
        });
        it('accept :NUM (port specifier)', () => {
            const test = '#foo:bar.com:2225';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:bar.com:2225",
                type: "roomalias",
                value: "#foo:bar.com:2225",
            }]));
        });
        it('ignores all the trailing :', () => {
            const test = '#foo:bar.com::::';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo:bar.com",
                type: "roomalias",
                value: "#foo:bar.com",
            }]));
        });
        it('properly parses room alias with dots in name', () => {
            const test = '#foo.asdf:bar.com::::';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "#foo.asdf:bar.com",
                type: "roomalias",
                value: "#foo.asdf:bar.com",
            }]));
        });
        it('does not parse room alias with too many separators', () => {
            const test = '#foo:::bar.com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "http://bar.com",
                type: "url",
                value: "bar.com",
            }]));
        });
        it('does not parse multiple room aliases in one string', () => {
            const test = '#foo:bar.com-baz.com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                "href": "#foo:bar.com-baz.com",
                "type": "roomalias",
                "value": "#foo:bar.com-baz.com",
            }]));
        });
    });

    describe('groupid', () => {
        it('properly parses +foo:localhost', () => {
            const test = "+foo:localhost";
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "+foo:localhost",
                type: "groupid",
                value: "+foo:localhost",
            }]));
        });
        it('accept +foo:bar.com', () => {
            const test = '+foo:bar.com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "+foo:bar.com",
                type: "groupid",
                value: "+foo:bar.com",
            }]));
        });
        it('accept +foo:com (mostly for (TLD|DOMAIN)+ mixing)', () => {
            const test = '+foo:com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "+foo:com",
                type: "groupid",
                value: "+foo:com",
            }]));
        });
        it('accept repeated TLDs (e.g .org.uk)', () => {
            const test = '+foo:bar.org.uk';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "+foo:bar.org.uk",
                type: "groupid",
                value: "+foo:bar.org.uk",
            }]));
        });
        it('ignore trailing `:`', () => {
            const test = '+foo:bar.com:';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                "href": "+foo:bar.com",
                "type": "groupid",
                "value": "+foo:bar.com",
            }]));
        });
        it('accept :NUM (port specifier)', () => {
            const test = '+foo:bar.com:2225';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "+foo:bar.com:2225",
                type: "groupid",
                value: "+foo:bar.com:2225",
            }]));
        });
    });

    describe('userid', () => {
        it('should not parse @foo without domain', () => {
            const test = "@foo";
            const found = linkify.find(test);
            expect(found).toEqual(([]));
        });
        it('accept @foo:bar.com', () => {
            const test = '@foo:bar.com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "@foo:bar.com",
                type: "userid",
                value: "@foo:bar.com",
            }]));
        });
        it('accept @foo:com (mostly for (TLD|DOMAIN)+ mixing)', () => {
            const test = '@foo:com';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "@foo:com",
                type: "userid",
                value: "@foo:com",
            }]));
        });
        it('accept repeated TLDs (e.g .org.uk)', () => {
            const test = '@foo:bar.org.uk';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "@foo:bar.org.uk",
                type: "userid",
                value: "@foo:bar.org.uk",
            }]));
        });
        it('do not accept trailing `:`', () => {
            const test = '@foo:bar.com:';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "@foo:bar.com",
                type: "userid",
                value: "@foo:bar.com",
            }]));
        });
        it('accept :NUM (port specifier)', () => {
            const test = '@foo:bar.com:2225';
            const found = linkify.find(test);
            expect(found).toEqual(([{
                href: "@foo:bar.com:2225",
                type: "userid",
                value: "@foo:bar.com:2225",
            }]));
        });
    });
});
