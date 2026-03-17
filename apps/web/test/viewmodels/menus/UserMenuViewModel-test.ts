/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { MatrixError, type MatrixClient } from "matrix-js-sdk/src/matrix";

import type { MockedObject } from "jest-mock";
import { UserMenuViewModel } from "../../../src/viewmodels/menus/UserMenuViewModel";
import { getMockClientWithEventEmitter, mockClientMethodsServer, mockClientMethodsUser } from "../../test-utils";
import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import SdkConfig from "../../../src/SdkConfig";

describe("UserMenuViewModel", () => {
    let dispatcher: MatrixDispatcher;
    let client: MockedObject<MatrixClient>;
    beforeEach(() => {
        dispatcher = new MatrixDispatcher();
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            getAuthMetadata: jest.fn().mockRejectedValue(new MatrixError({ errcode: "M_UNRECOGNIZED" }, 404)),
        });
        SdkContextClass.instance.client = client;
    });
    afterEach(() => {
        jest.resetAllMocks();
        SdkContextClass.instance.onLoggedOut();
        SdkContextClass.instance.client = undefined;
    });
    it("should not generate actions until the menu is opened", () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        expect(vm.getSnapshot()).toMatchInlineSnapshot(`
{
  "actions": [],
  "avatarUrl": undefined,
  "displayName": "@alice:domain",
  "expanded": false,
  "manageAccountHref": undefined,
  "open": false,
  "userId": "@alice:domain",
}
`);
    });
    it("should generate a menu options for a logged in client", () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot()).toMatchSnapshot();
    });
    it("should show a link for account management", async () => {
        const vm = new UserMenuViewModel(dispatcher, client, true, "https://example.org/");
        vm.setOpen(true);
        expect(vm.getSnapshot().manageAccountHref).toEqual("https://example.org/");
    });
    it("should generate a menu options for a guest", () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot()).toMatchSnapshot();
    });
    it("should generate a menu options that include feedback", () => {
        SdkConfig.put({ bug_report_endpoint_url: "https://example.org" });
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().actions).toContainEqual({
            label: "Feedback",
            onSelect: expect.anything(),
            icon: expect.anything(),
        });
    });
    it("should generate a menu options that includes a home page", () => {
        SdkConfig.put({ embedded_pages: { home_url: "https://example.org" } });
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().actions).toContainEqual({
            label: "Home",
            onSelect: expect.anything(),
            icon: expect.anything(),
        });
    });
    it("can toggle menu", () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().open).toEqual(true);
        vm.setOpen(false);
        expect(vm.getSnapshot().open).toEqual(false);
    });
    it("can toggle expanded state", () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setExpanded(true);
        expect(vm.getSnapshot().expanded).toEqual(true);
        vm.setExpanded(false);
        expect(vm.getSnapshot().expanded).toEqual(false);
    });
});
