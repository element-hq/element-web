import React from "react";
import expect from 'expect';
import Adapter from "enzyme-adapter-react-16";
import { configure, mount } from "enzyme";

import sdk from "../../../skinned-sdk";
import {mkEvent, mkStubRoom} from "../../../test-utils";
import MatrixClientPeg from "../../../../src/MatrixClientPeg";

const TextualBody = sdk.getComponent("views.messages.TextualBody");

configure({ adapter: new Adapter() });

describe("<TextualBody />", () => {
    afterEach(() => {
        MatrixClientPeg.matrixClient = null;
    });

    describe("renders m.emote correctly", () => {
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

    describe("renders m.notice correctly", () => {
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
        MatrixClientPeg.matrixClient = {
            getRoom: () => mkStubRoom("room_id"),
            getAccountData: () => undefined,
        };

        describe("simple message renders as expected", () => {
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
        describe("linkification get applied correctly into the DOM", () => {
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
                'Visit <a href="https://matrix.org/" class="linkified" target="_blank" rel="noopener">' +
                'https://matrix.org/</a></span>');
        });
    });

    describe("renders formatted m.text correctly", () => {
        MatrixClientPeg.matrixClient = {
            getRoom: () => mkStubRoom("room_id"),
            getAccountData: () => undefined,
            getUserId: () => "@me:my_server",
            getHomeserverUrl: () => "https://my_server/",
            on: () => undefined,
            removeListener: () => undefined,
        };

        describe("italics, bold, underline and strikethrough render as expected", () => {
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

        describe("spoilers get injected properly into the DOM", () => {
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
        describe("pills get injected correctly into the DOM", () => {
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
                'width="16" height="16" title="@member:domain.bla" alt="">Member</a>' +
                '</span></span>');
        });
    });
});


