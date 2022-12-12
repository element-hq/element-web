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

import Markdown from "../src/Markdown";

describe("Markdown parser test", () => {
    describe("fixing HTML links", () => {
        const testString = [
            "Test1:",
            "#_foonetic_xkcd:matrix.org",
            "http://google.com/_thing_",
            "https://matrix.org/_matrix/client/foo/123_",
            "#_foonetic_xkcd:matrix.org",
            "",
            "Test1A:",
            "#_foonetic_xkcd:matrix.org",
            "http://google.com/_thing_",
            "https://matrix.org/_matrix/client/foo/123_",
            "#_foonetic_xkcd:matrix.org",
            "",
            "Test2:",
            "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
            "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
            "",
            "Test3:",
            "https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org",
            "https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org",
        ].join("\n");

        it("tests that links with markdown empasis in them are getting properly HTML formatted", () => {
            /* eslint-disable max-len */
            const expectedResult = [
                "<p>Test1:<br />#_foonetic_xkcd:matrix.org<br />http://google.com/_thing_<br />https://matrix.org/_matrix/client/foo/123_<br />#_foonetic_xkcd:matrix.org</p>",
                "<p>Test1A:<br />#_foonetic_xkcd:matrix.org<br />http://google.com/_thing_<br />https://matrix.org/_matrix/client/foo/123_<br />#_foonetic_xkcd:matrix.org</p>",
                "<p>Test2:<br />http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg<br />http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg</p>",
                "<p>Test3:<br />https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org<br />https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org</p>",
                "",
            ].join("\n");
            /* eslint-enable max-len */
            const md = new Markdown(testString);
            expect(md.toHTML()).toEqual(expectedResult);
        });
        it("tests that links with autolinks are not touched at all and are still properly formatted", () => {
            const test = [
                "Test1:",
                "<#_foonetic_xkcd:matrix.org>",
                "<http://google.com/_thing_>",
                "<https://matrix.org/_matrix/client/foo/123_>",
                "<#_foonetic_xkcd:matrix.org>",
                "",
                "Test1A:",
                "<#_foonetic_xkcd:matrix.org>",
                "<http://google.com/_thing_>",
                "<https://matrix.org/_matrix/client/foo/123_>",
                "<#_foonetic_xkcd:matrix.org>",
                "",
                "Test2:",
                "<http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg>",
                "<http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg>",
                "",
                "Test3:",
                "<https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org>",
                "<https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org>",
            ].join("\n");
            /* eslint-disable max-len */
            /**
             * NOTE: I'm not entirely sure if those "<"" and ">" should be visible in here for #_foonetic_xkcd:matrix.org
             * but it seems to be actually working properly
             */
            const expectedResult = [
                '<p>Test1:<br />&lt;#_foonetic_xkcd:matrix.org&gt;<br /><a href="http://google.com/_thing_">http://google.com/_thing_</a><br /><a href="https://matrix.org/_matrix/client/foo/123_">https://matrix.org/_matrix/client/foo/123_</a><br />&lt;#_foonetic_xkcd:matrix.org&gt;</p>',
                '<p>Test1A:<br />&lt;#_foonetic_xkcd:matrix.org&gt;<br /><a href="http://google.com/_thing_">http://google.com/_thing_</a><br /><a href="https://matrix.org/_matrix/client/foo/123_">https://matrix.org/_matrix/client/foo/123_</a><br />&lt;#_foonetic_xkcd:matrix.org&gt;</p>',
                '<p>Test2:<br /><a href="http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg">http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg</a><br /><a href="http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg">http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg</a></p>',
                '<p>Test3:<br /><a href="https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org">https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org</a><br /><a href="https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org">https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org</a></p>',
                "",
            ].join("\n");
            /* eslint-enable max-len */
            const md = new Markdown(test);
            expect(md.toHTML()).toEqual(expectedResult);
        });

        it("expects that links in codeblock are not modified", () => {
            const expectedResult = [
                '<pre><code class="language-Test1:">#_foonetic_xkcd:matrix.org',
                "http://google.com/_thing_",
                "https://matrix.org/_matrix/client/foo/123_",
                "#_foonetic_xkcd:matrix.org",
                "",
                "Test1A:",
                "#_foonetic_xkcd:matrix.org",
                "http://google.com/_thing_",
                "https://matrix.org/_matrix/client/foo/123_",
                "#_foonetic_xkcd:matrix.org",
                "",
                "Test2:",
                "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
                "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
                "",
                "Test3:",
                "https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org",
                "https://riot.im/app/#/room/#_foonetic_xkcd:matrix.org```",
                "</code></pre>",
                "",
            ].join("\n");
            const md = new Markdown("```" + testString + "```");
            expect(md.toHTML()).toEqual(expectedResult);
        });

        it('expects that links with emphasis are "escaped" correctly', () => {
            /* eslint-disable max-len */
            const testString = [
                "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg" +
                    " " +
                    "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
                "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg" +
                    " " +
                    "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
                "https://example.com/_test_test2_-test3",
                "https://example.com/_test_test2_test3_",
                "https://example.com/_test__test2_test3_",
                "https://example.com/_test__test2__test3_",
                "https://example.com/_test__test2_test3__",
                "https://example.com/_test__test2",
            ].join("\n");
            const expectedResult = [
                "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
                "http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg http://domain.xyz/foo/bar-_stuff-like-this_-in-it.jpg",
                "https://example.com/_test_test2_-test3",
                "https://example.com/_test_test2_test3_",
                "https://example.com/_test__test2_test3_",
                "https://example.com/_test__test2__test3_",
                "https://example.com/_test__test2_test3__",
                "https://example.com/_test__test2",
            ].join("<br />");
            /* eslint-enable max-len */
            const md = new Markdown(testString);
            expect(md.toHTML()).toEqual(expectedResult);
        });

        it("expects that the link part will not be accidentally added to <strong>", () => {
            /* eslint-disable max-len */
            const testString = `https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py`;
            const expectedResult = "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py";
            /* eslint-enable max-len */
            const md = new Markdown(testString);
            expect(md.toHTML()).toEqual(expectedResult);
        });

        it("expects that the link part will not be accidentally added to <strong> for multiline links", () => {
            /* eslint-disable max-len */
            const testString = [
                "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py" +
                    " " +
                    "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py",
                "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py" +
                    " " +
                    "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py",
            ].join("\n");
            const expectedResult = [
                "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py" +
                    " " +
                    "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py",
                "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py" +
                    " " +
                    "https://github.com/matrix-org/synapse/blob/develop/synapse/module_api/__init__.py",
            ].join("<br />");
            /* eslint-enable max-len */
            const md = new Markdown(testString);
            expect(md.toHTML()).toEqual(expectedResult);
        });

        it("resumes applying formatting to the rest of a message after a link", () => {
            const testString = "http://google.com/_thing_ *does* __not__ exist";
            const expectedResult = "http://google.com/_thing_ <em>does</em> <strong>not</strong> exist";
            const md = new Markdown(testString);
            expect(md.toHTML()).toEqual(expectedResult);
        });
    });
});
