/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { MatrixError, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "jest-matrix-react";

import type { MockedObject } from "jest-mock";
import { UserMenuViewModel } from "../../../src/viewmodels/menus/UserMenuViewModel";
import { getMockClientWithEventEmitter, mockClientMethodsServer, mockClientMethodsUser } from "../../test-utils";
import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import SdkConfig from "../../../src/SdkConfig";
import { Action } from "../../../src/dispatcher/actions";
import { UserTab } from "../../../src/components/views/dialogs/UserTab";
import Modal from "../../../src/Modal";
import FeedbackDialog from "../../../src/components/views/dialogs/FeedbackDialog";

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
        SdkConfig.reset();
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
        client.isGuest.mockReturnValue(true);
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

    it("can open the home menu", async () => {
        SdkConfig.put({ embedded_pages: { home_url: "https://example.org" } });
        const vm = new UserMenuViewModel(dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.getSnapshot()
            .actions.find((action) => action.label === "Home")!
            .onSelect();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewHomePage,
            }),
        );
    });

    it("can open the 'link new device' settings menu", async () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.getSnapshot()
            .actions.find((action) => action.label === "Link new device")!
            .onSelect();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.SessionManager,
                props: { showMsc4108QrCode: true },
            }),
        );
    });

    it("can open the 'security' settings menu", async () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.getSnapshot()
            .actions.find((action) => action.label === "Security & Privacy")!
            .onSelect();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Security,
            }),
        );
    });

    it("can open the 'feedback' settings menu", async () => {
        jest.spyOn(Modal, "createDialog");
        SdkConfig.put({ bug_report_endpoint_url: "https://example.org" });
        const vm = new UserMenuViewModel(dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.getSnapshot()
            .actions.find((action) => action.label === "Feedback")!
            .onSelect();
        expect(Modal.createDialog).toHaveBeenCalledWith(FeedbackDialog);
    });
    it("can open the settings menu", async () => {
        const vm = new UserMenuViewModel(dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.getSnapshot()
            .actions.find((action) => action.label === "All settings")!
            .onSelect();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
            }),
        );
    });
    it("should be able to open the createAccount screen as a guest", async () => {
        client.isGuest.mockReturnValue(true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        vm.getSnapshot().createAccount!();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: "start_registration",
            }),
        );
    });
    it("should be able to open the onSignIn screen as a guest", async () => {
        client.isGuest.mockReturnValue(true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        const vm = new UserMenuViewModel(dispatcher, client, true);
        vm.setOpen(true);
        vm.getSnapshot().signIn!();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: "start_login",
            }),
        );
    });
});
