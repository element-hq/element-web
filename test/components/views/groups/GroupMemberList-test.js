/*
Copyright 2018 New Vector Ltd.

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
import ReactDOM from "react-dom";
import ReactTestUtils from "react-dom/test-utils";

import MockHttpBackend from "matrix-mock-request";
import {MatrixClientPeg} from "../../../../src/MatrixClientPeg";
import sdk from "../../../skinned-sdk";
import Matrix from "matrix-js-sdk";

import * as TestUtils from "../../../test-utils";
const { waitForUpdate } = TestUtils;

const GroupMemberList = sdk.getComponent("views.groups.GroupMemberList");
const WrappedGroupMemberList = TestUtils.wrapInMatrixClientContext(GroupMemberList);

describe("GroupMemberList", function() {
    let root;
    let rootElement;
    let httpBackend;
    let summaryResponse;
    let groupId;
    let groupIdEncoded;

    // Summary response fields
    const user = {
        is_privileged: true, // can edit the group
        is_public: true, // appear as a member to non-members
        is_publicised: true, // display flair
    };
    const usersSection = {
        roles: {},
        total_user_count_estimate: 0,
        users: [],
    };
    const roomsSection = {
        categories: {},
        rooms: [],
        total_room_count_estimate: 0,
    };

    // Users response fields
    const usersResponse = {
        chunk: [
            {
                user_id: "@test:matrix.org",
                displayname: "Test",
                avatar_url: "mxc://matrix.org/oUxxDyzQOHdVDMxgwFzyCWEe",
                is_public: true,
                is_privileged: true,
                attestation: {},
            },
        ],
    };

    beforeEach(function() {
        httpBackend = new MockHttpBackend();

        Matrix.request(httpBackend.requestFn);

        MatrixClientPeg.get = () => Matrix.createClient({
            baseUrl: "https://my.home.server",
            userId: "@me:here",
            accessToken: "123456789",
        });

        summaryResponse = {
            profile: {
                avatar_url: "mxc://someavatarurl",
                is_openly_joinable: true,
                is_public: true,
                long_description: "This is a <b>LONG</b> description.",
                name: "The name of a community",
                short_description: "This is a community",
            },
            user,
            users_section: usersSection,
            rooms_section: roomsSection,
        };

        groupId = "+" + Math.random().toString(16).slice(2) + ":domain";
        groupIdEncoded = encodeURIComponent(groupId);

        rootElement = document.createElement("div");
        root = ReactDOM.render(<WrappedGroupMemberList groupId={groupId} />, rootElement);
    });

    afterEach(function() {
        ReactDOM.unmountComponentAtNode(rootElement);
    });

    it("should show group member list after successful /users", function() {
        const groupMemberList = ReactTestUtils.findRenderedComponentWithType(root, GroupMemberList);
        const prom = waitForUpdate(groupMemberList, 4).then(() => {
            ReactTestUtils.findRenderedDOMComponentWithClass(root, "mx_MemberList");

            const memberList = ReactTestUtils.findRenderedDOMComponentWithClass(root, "mx_MemberList_joined");
            const memberListElement = ReactDOM.findDOMNode(memberList);
            expect(memberListElement).toBeTruthy();
            const userNameElement = memberListElement.querySelector(".mx_EntityTile_name");
            expect(userNameElement).toBeTruthy();
            expect(userNameElement.textContent).toBe("Test");
        });

        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/summary").respond(200, summaryResponse);
        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/users").respond(200, usersResponse);
        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/invited_users").respond(200, { chunk: [] });
        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/rooms").respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });

    it("should show error message after failed /users", function() {
        const groupMemberList = ReactTestUtils.findRenderedComponentWithType(root, GroupMemberList);
        const prom = waitForUpdate(groupMemberList, 4).then(() => {
            ReactTestUtils.findRenderedDOMComponentWithClass(root, "mx_MemberList");

            const memberList = ReactTestUtils.findRenderedDOMComponentWithClass(root, "mx_MemberList_joined");
            const memberListElement = ReactDOM.findDOMNode(memberList);
            expect(memberListElement).toBeTruthy();
            expect(memberListElement.textContent).toBe("Failed to load group members");
        });

        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/summary").respond(200, summaryResponse);
        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/users").respond(500, {});
        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/invited_users").respond(200, { chunk: [] });
        httpBackend.when("GET", "/groups/" + groupIdEncoded + "/rooms").respond(200, { chunk: [] });

        httpBackend.flush(undefined, undefined, 0);
        return prom;
    });
});
