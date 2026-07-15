/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { MatrixError, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "jest-matrix-react";

import type { MockedObject } from "jest-mock-vitest-adapter";
import { UserMenuViewModel } from "../../../src/viewmodels/menus/UserMenuViewModel";
import { getMockClientWithEventEmitter, mockClientMethodsServer, mockClientMethodsUser } from "../../test-utils";
import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { SDKContextClass } from "../../../src/contexts/SDKContextClass";
import SdkConfig from "../../../src/SdkConfig";
import { Action } from "../../../src/dispatcher/actions";
import { UserTab } from "../../../src/components/views/dialogs/UserTab";
import Modal from "../../../src/Modal";
import FeedbackDialog from "../../../src/components/views/dialogs/FeedbackDialog";
import { type OwnProfileStore } from "../../../src/stores/OwnProfileStore";
import { TestSDKContext } from "../../unit-tests/TestSDKContext.ts";

describe("UserMenuViewModel", () => {
    let dispatcher: MatrixDispatcher;
    let client: MockedObject<MatrixClient>;
    let mockOwnProfileStore: OwnProfileStore;
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        dispatcher = new MatrixDispatcher();
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            getAuthMetadata: jest.fn().mockRejectedValue(new MatrixError({ errcode: "M_UNRECOGNIZED" }, 404)),
            setExtendedProfileProperty: jest.fn().mockResolvedValue(undefined),
        });
        sdkContext = new TestSDKContext();
        // @ts-ignore UserMenuViewModel uses SDKContext in the constructor
        SDKContextClass.instance = sdkContext;
        sdkContext._client = client;

        mockOwnProfileStore = {
            displayName: "Sally Sanderson",
            userStatus: undefined,
            getHttpAvatarUrl: jest.fn().mockReturnValue("https://foo.dummy/avatar.png"),
            on: jest.fn(),
        } as unknown as OwnProfileStore;
    });
    afterEach(() => {
        jest.resetAllMocks();
        SdkConfig.reset();
        SDKContextClass.instance.onLoggedOut();
    });

    it("should generate a menu options for a logged in client", () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().userId).toEqual("@alice:domain");
        expect(vm.getSnapshot().displayName).toEqual("Sally Sanderson");
        expect(vm.getSnapshot().avatarUrl).toEqual("https://foo.dummy/avatar.png");
        expect(vm.getSnapshot().showAvatar).toEqual(true);
        expect(vm.getSnapshot().expanded).toEqual(false);
    });

    it("should show a link for account management", async () => {
        client.getAuthMetadata.mockResolvedValue({ account_management_uri: "https://example.org/" } as any);
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        await waitFor(() => {
            expect(vm.getSnapshot().manageAccountHref).toEqual("https://example.org/");
        });
    });

    it("should generate a menu options for a guest", () => {
        client.isGuest.mockReturnValue(true);
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().displayName).toEqual("Sally Sanderson");
        expect(vm.getSnapshot().showAvatar).toEqual(false);
        expect(vm.getSnapshot().showUserStatus).toEqual(false);
    });

    it("should generate a menu options that include feedback", () => {
        SdkConfig.put({ bug_report_endpoint_url: "https://example.org" });
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().actions.openFeedback).toEqual(true);
    });

    it("should generate a menu options that includes a home page", () => {
        SdkConfig.put({ embedded_pages: { home_url: "https://example.org" } });
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().actions.openHomePage).toEqual(true);
    });

    it("can toggle menu", () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        expect(vm.getSnapshot().open).toEqual(true);
        vm.setOpen(false);
        expect(vm.getSnapshot().open).toEqual(false);
    });

    it("can toggle expanded state", () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setExpanded(true);
        expect(vm.getSnapshot().expanded).toEqual(true);
        vm.setExpanded(false);
        expect(vm.getSnapshot().expanded).toEqual(false);
    });

    it("can open the home menu", async () => {
        SdkConfig.put({ embedded_pages: { home_url: "https://example.org" } });
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.openHomePage();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewHomePage,
            }),
        );
    });

    it("can open the 'link new device' settings menu", async () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.linkNewDevice();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.SessionManager,
                props: { showMsc4108QrCode: true },
            }),
        );
    });

    it("can open the 'security' settings menu", async () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.openSecurity();
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
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.openFeedback();
        expect(Modal.createDialog).toHaveBeenCalledWith(FeedbackDialog);
    });

    it("can open the settings menu", async () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        vm.setOpen(true);
        vm.openSettings();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
            }),
        );
    });

    it("can clear a user status", async () => {
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        vm.clearStatus();
        await waitFor(() =>
            expect(client.setExtendedProfileProperty).toHaveBeenCalledWith("org.matrix.msc4426.status", null),
        );
    });

    it("should be able to open the createAccount screen as a guest", async () => {
        client.isGuest.mockReturnValue(true);
        const dispatcherSpy = jest.fn();
        dispatcher.register(dispatcherSpy);
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        vm.createAccount();
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
        const vm = new UserMenuViewModel({ ownProfileStore: mockOwnProfileStore }, dispatcher, client, true);
        vm.setOpen(true);
        vm.signIn();
        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: "start_login",
            }),
        );
    });
});
