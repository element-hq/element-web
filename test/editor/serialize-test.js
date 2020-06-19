/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import EditorModel from "../../src/editor/model";
import {htmlSerializeIfNeeded} from "../../src/editor/serialize";
import {createPartCreator} from "./mock";

describe('editor/serialize', function() {
    it('user pill turns message into html', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.userPill("Alice", "@alice:hs.tld")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe("<a href=\"https://matrix.to/#/@alice:hs.tld\">Alice</a>");
    });
    it('room pill turns message into html', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.roomPill("#room:hs.tld")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe("<a href=\"https://matrix.to/#/#room:hs.tld\">#room:hs.tld</a>");
    });
    it('@room pill turns message into html', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.atRoomPill("@room")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBeFalsy();
    });
    it('any markdown turns message into html', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("*hello* world")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe("<em>hello</em> world");
    });
    it('displaynames ending in a backslash work', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.userPill("Displayname\\", "@user:server")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe("<a href=\"https://matrix.to/#/@user:server\">Displayname\\</a>");
    });
    it('displaynames containing an opening square bracket work', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.userPill("Displayname[[", "@user:server")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe("<a href=\"https://matrix.to/#/@user:server\">Displayname[[</a>");
    });
    it('displaynames containing a closing square bracket work', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.userPill("Displayname]", "@user:server")]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe("<a href=\"https://matrix.to/#/@user:server\">Displayname]</a>");
    });
    it('escaped markdown should not retain backslashes', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain('\\*hello\\* world')]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe('*hello* world');
    });
    it('escaped markdown should convert HTML entities', function() {
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain('\\*hello\\* world < hey world!')]);
        const html = htmlSerializeIfNeeded(model, {});
        expect(html).toBe('*hello* world &lt; hey world!');
    });
});
