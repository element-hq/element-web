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

import React from "react";
import Adapter from "enzyme-adapter-react-16";
import { configure, mount } from "enzyme";

import sdk from "../../../skinned-sdk";
import {mkEvent, mkStubRoom} from "../../../test-utils";
import {MatrixClientPeg} from "../../../../src/MatrixClientPeg";
import * as languageHandler from "../../../../src/languageHandler";

const TextualBody = sdk.getComponent("views.messages.TextualBody");

configure({ adapter: new Adapter() });

describe("<TextualBody />", () => {
    afterEach(() => {
        MatrixClientPeg.matrixClient = null;
    });

    it("renders m.emote correctly", () => {
        MatrixClientPeg.matrixClient = {
            getRoom: () => mkStubRoom("room_id"),
            getAccountData: () => undefined,
        };

        const ev = mkEvent({
            type: "m.room.message",
            room: "room_id",
            user: "sender",
            content: {
                body: "winks",
                msgtype: "m.emote",
            },
            event: true,
        });

        const wrapper = mount(<TextualBody mxEvent={ev} />);
        expect(wrapper.text()).toBe("* sender winks");
        const content = wrapper.find(".mx_EventTile_body");
        expect(content.html()).toBe('<span class="mx_EventTile_body" dir="auto">winks</span>');
    });

    it("renders m.notice correctly", () => {
        MatrixClientPeg.matrixClient = {
            getRoom: () => mkStubRoom("room_id"),
            getAccountData: () => undefined,
        };

        const ev = mkEvent({
            type: "m.room.message",
            room: "room_id",
            user: "bot_sender",
            content: {
                body: "this is a notice, probably from a bot",
                msgtype: "m.notice",
            },
            event: true,
        });

        const wrapper = mount(<TextualBody mxEvent={ev} />);
        expect(wrapper.text()).toBe(ev.getContent().body);
        const content = wrapper.find(".mx_EventTile_body");
        expect(content.html()).toBe(`<span class="mx_EventTile_body" dir="auto">${ ev.getContent().body }</span>`);
    });

    describe("renders plain-text m.text correctly", () => {
        beforeEach(() => {
            MatrixClientPeg.matrixClient = {
                getRoom: () => mkStubRoom("room_id"),
                getAccountData: () => undefined,
            };
        });

        it("simple message renders as expected", () => {
            const ev = mkEvent({
                type: "m.room.message",
                room: "room_id",
                user: "sender",
                content: {
                    body: "this is a plaintext message",
                    msgtype: "m.text",
                },
                event: true,
            });

            const wrapper = mount(<TextualBody mxEvent={ev} />);
            expect(wrapper.text()).toBe(ev.getContent().body);
            const content = wrapper.find(".mx_EventTile_body");
            expect(content.html()).toBe(`<span class="mx_EventTile_body" dir="auto">${ ev.getContent().body }</span>`);
        });

        // If pills were rendered within a Portal/same shadow DOM then it'd be easier to test
        it("linkification get applied correctly into the DOM", () => {
            const ev = mkEvent({
                type: "m.room.message",
                room: "room_id",
                user: "sender",
                content: {
                    body: "Visit https://matrix.org/",
                    msgtype: "m.text",
                },
                event: true,
            });

            const wrapper = mount(<TextualBody mxEvent={ev} />);
            expect(wrapper.text()).toBe(ev.getContent().body);
            const content = wrapper.find(".mx_EventTile_body");
            expect(content.html()).toBe('<span class="mx_EventTile_body" dir="auto">' +
                'Visit <a href="https://matrix.org/" class="linkified" target="_blank" rel="noreferrer noopener">' +
                'https://matrix.org/</a></span>');
        });
    });

    describe("renders formatted m.text correctly", () => {
        beforeEach(() => {
            MatrixClientPeg.matrixClient = {
                getRoom: () => mkStubRoom("room_id"),
                getAccountData: () => undefined,
                getUserId: () => "@me:my_server",
                getHomeserverUrl: () => "https://my_server/",
                on: () => undefined,
                removeListener: () => undefined,
            };
        });

        it("italics, bold, underline and strikethrough render as expected", () => {
            const ev = mkEvent({
                type: "m.room.message",
                room: "room_id",
                user: "sender",
                content: {
                    body: "foo *baz* __bar__ <del>del</del> <u>u</u>",
                    msgtype: "m.text",
                    format: "org.matrix.custom.html",
                    formatted_body: "foo <em>baz</em> <strong>bar</strong> <del>del</del> <u>u</u>",
                },
                event: true,
            });

            const wrapper = mount(<TextualBody mxEvent={ev} />);
            expect(wrapper.text()).toBe("foo baz bar del u");
            const content = wrapper.find(".mx_EventTile_body");
            expect(content.html()).toBe('<span class="mx_EventTile_body markdown-body" dir="auto">' +
                ev.getContent().formatted_body + '</span>');
        });

        it("spoilers get injected properly into the DOM", () => {
            const ev = mkEvent({
                type: "m.room.message",
                room: "room_id",
                user: "sender",
                content: {
                    body: "Hey [Spoiler for movie](mxc://someserver/somefile)",
                    msgtype: "m.text",
                    format: "org.matrix.custom.html",
                    formatted_body: "Hey <span data-mx-spoiler=\"movie\">the movie was awesome</span>",
                },
                event: true,
            });

            const wrapper = mount(<TextualBody mxEvent={ev} />);
            expect(wrapper.text()).toBe("Hey (movie) the movie was awesome");
            const content = wrapper.find(".mx_EventTile_body");
            expect(content.html()).toBe('<span class="mx_EventTile_body markdown-body" dir="auto">' +
                'Hey <span>' +
                '<span class="mx_EventTile_spoiler">' +
                '<span class="mx_EventTile_spoiler_reason">(movie)</span>&nbsp;' +
                '<span class="mx_EventTile_spoiler_content"><span>the movie was awesome</span></span>' +
                '</span></span></span>');
        });

        // If pills were rendered within a Portal/same shadow DOM then it'd be easier to test
        it("pills get injected correctly into the DOM", () => {
            const ev = mkEvent({
                type: "m.room.message",
                room: "room_id",
                user: "sender",
                content: {
                    body: "Hey User",
                    msgtype: "m.text",
                    format: "org.matrix.custom.html",
                    formatted_body: "Hey <a href=\"https://matrix.to/#/@user:server\">Member</a>",
                },
                event: true,
            });

            const wrapper = mount(<TextualBody mxEvent={ev} />);
            expect(wrapper.text()).toBe("Hey Member");
            const content = wrapper.find(".mx_EventTile_body");
            expect(content.html()).toBe('<span class="mx_EventTile_body markdown-body" dir="auto">' +
                'Hey <span>' +
                '<a class="mx_Pill mx_UserPill" title="@user:server">' +
                '<img class="mx_BaseAvatar mx_BaseAvatar_image" src="mxc://avatar.url/image.png" ' +
                'style="width: 16px; height: 16px;" ' +
                'title="@member:domain.bla" alt="" aria-hidden="true">Member</a>' +
                '</span></span>');
        });
    });

    it("renders url previews correctly", () => {
        languageHandler.setMissingEntryGenerator(key => key.split('|', 2)[1]);

        MatrixClientPeg.matrixClient = {
            getRoom: () => mkStubRoom("room_id"),
            getAccountData: () => undefined,
            getUrlPreview: (url) => new Promise(() => {}),
        };

        const ev = mkEvent({
            type: "m.room.message",
            room: "room_id",
            user: "sender",
            content: {
                body: "Visit https://matrix.org/",
                msgtype: "m.text",
            },
            event: true,
        });

        const wrapper = mount(<TextualBody mxEvent={ev} showUrlPreview={true} />);
        expect(wrapper.text()).toBe(ev.getContent().body);

        let widgets = wrapper.find("LinkPreviewWidget");
        // at this point we should have exactly one widget
        expect(widgets.length).toBe(1);
        expect(widgets.at(0).prop("link")).toBe("https://matrix.org/");

        // simulate an event edit and check the transition from the old URL preview to the new one
        const ev2 = mkEvent({
            type: "m.room.message",
            room: "room_id",
            user: "sender",
            content: {
                "m.new_content": {
                    body: "Visit https://vector.im/ and https://riot.im/",
                    msgtype: "m.text",
                },
            },
            event: true,
        });
        ev.makeReplaced(ev2);

        wrapper.setProps({
            mxEvent: ev,
            replacingEventId: ev.getId(),
        }, () => {
            expect(wrapper.text()).toBe(ev2.getContent()["m.new_content"].body + "(edited)");

            // XXX: this is to give TextualBody enough time for state to settle
            wrapper.setState({}, () => {
                widgets = wrapper.find("LinkPreviewWidget");
                // at this point we should have exactly two widgets (not the matrix.org one anymore)
                expect(widgets.length).toBe(2);
                expect(widgets.at(0).prop("link")).toBe("https://vector.im/");
                expect(widgets.at(1).prop("link")).toBe("https://riot.im/");
            });
        });
    });
});


