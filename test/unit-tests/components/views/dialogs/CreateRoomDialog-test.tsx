/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, within } from "jest-matrix-react";
import { JoinRule, MatrixError, Preset, Visibility } from "matrix-js-sdk/src/matrix";

import CreateRoomDialog from "../../../../../src/components/views/dialogs/CreateRoomDialog";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";

describe("<CreateRoomDialog />", () => {
    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getDomain: jest.fn().mockReturnValue("server.org"),
        getClientWellKnown: jest.fn(),
        doesServerForceEncryptionForPreset: jest.fn(),
        // make every alias available
        getRoomIdForAlias: jest.fn().mockRejectedValue(new MatrixError({ errcode: "M_NOT_FOUND" })),
    });

    const getE2eeEnableToggleInputElement = () => screen.getByLabelText("Enable end-to-end encryption");
    // labelled toggle switch doesn't set the disabled attribute, only aria-disabled
    const getE2eeEnableToggleIsDisabled = () =>
        getE2eeEnableToggleInputElement().getAttribute("aria-disabled") === "true";

    beforeEach(() => {
        mockClient.doesServerForceEncryptionForPreset.mockResolvedValue(false);
        mockClient.getClientWellKnown.mockReturnValue({});
    });

    const getComponent = (props = {}) => render(<CreateRoomDialog onFinished={jest.fn()} {...props} />);

    it("should default to private room", async () => {
        getComponent();
        await flushPromises();

        expect(screen.getByText("Create a private room")).toBeInTheDocument();
    });

    it("should use defaultName from props", async () => {
        const defaultName = "My test room";
        getComponent({ defaultName });
        await flushPromises();

        expect(screen.getByLabelText("Name")).toHaveDisplayValue(defaultName);
    });

    describe("for a private room", () => {
        // default behaviour is a private room

        it("should use server .well-known default for encryption setting", async () => {
            // default to off
            mockClient.getClientWellKnown.mockReturnValue({
                "io.element.e2ee": {
                    default: false,
                },
            });
            getComponent();
            await flushPromises();

            expect(getE2eeEnableToggleInputElement()).not.toBeChecked();
            expect(getE2eeEnableToggleIsDisabled()).toBeFalsy();
            expect(
                screen.getByText(
                    "Your server admin has disabled end-to-end encryption by default in private rooms & Direct Messages.",
                ),
            ).toBeDefined();
        });

        it("should use server .well-known force_disable for encryption setting", async () => {
            // force to off
            mockClient.getClientWellKnown.mockReturnValue({
                "io.element.e2ee": {
                    default: true,
                    force_disable: true,
                },
            });
            getComponent();
            await flushPromises();

            expect(getE2eeEnableToggleInputElement()).not.toBeChecked();
            expect(getE2eeEnableToggleIsDisabled()).toBeTruthy();
            expect(
                screen.getByText(
                    "Your server admin has disabled end-to-end encryption by default in private rooms & Direct Messages.",
                ),
            ).toBeDefined();
        });

        it("should use defaultEncrypted prop", async () => {
            // default to off in server wk
            mockClient.getClientWellKnown.mockReturnValue({
                "io.element.e2ee": {
                    default: false,
                },
            });
            // but pass defaultEncrypted prop
            getComponent({ defaultEncrypted: true });
            await flushPromises();
            // encryption enabled
            expect(getE2eeEnableToggleInputElement()).toBeChecked();
            expect(getE2eeEnableToggleIsDisabled()).toBeFalsy();
        });

        it("should use defaultEncrypted prop when it is false", async () => {
            // default to off in server wk
            mockClient.getClientWellKnown.mockReturnValue({
                "io.element.e2ee": {
                    default: true,
                },
            });
            // but pass defaultEncrypted prop
            getComponent({ defaultEncrypted: false });
            await flushPromises();
            // encryption disabled
            expect(getE2eeEnableToggleInputElement()).not.toBeChecked();
            // not forced to off
            expect(getE2eeEnableToggleIsDisabled()).toBeFalsy();
        });

        it("should override defaultEncrypted when server .well-known forces disabled encryption", async () => {
            // force to off
            mockClient.getClientWellKnown.mockReturnValue({
                "io.element.e2ee": {
                    force_disable: true,
                },
            });
            getComponent({ defaultEncrypted: true });
            await flushPromises();

            // server forces encryption to disabled, even though defaultEncrypted is false
            expect(getE2eeEnableToggleInputElement()).not.toBeChecked();
            expect(getE2eeEnableToggleIsDisabled()).toBeTruthy();
            expect(
                screen.getByText(
                    "Your server admin has disabled end-to-end encryption by default in private rooms & Direct Messages.",
                ),
            ).toBeDefined();
        });

        it("should override defaultEncrypted when server forces enabled encryption", async () => {
            mockClient.doesServerForceEncryptionForPreset.mockResolvedValue(true);
            getComponent({ defaultEncrypted: false });
            await flushPromises();

            // server forces encryption to enabled, even though defaultEncrypted is true
            expect(getE2eeEnableToggleInputElement()).toBeChecked();
            expect(getE2eeEnableToggleIsDisabled()).toBeTruthy();
            expect(screen.getByText("Your server requires encryption to be enabled in private rooms.")).toBeDefined();
        });

        it("should enable encryption toggle and disable field when server forces encryption", async () => {
            mockClient.doesServerForceEncryptionForPreset.mockResolvedValue(true);
            getComponent();

            await flushPromises();
            expect(getE2eeEnableToggleInputElement()).toBeChecked();
            expect(getE2eeEnableToggleIsDisabled()).toBeTruthy();

            expect(screen.getByText("Your server requires encryption to be enabled in private rooms.")).toBeDefined();
        });

        it("should warn when trying to create a room with an invalid form", async () => {
            const onFinished = jest.fn();
            getComponent({ onFinished });
            await flushPromises();

            fireEvent.click(screen.getByText("Create room"));
            await flushPromises();

            // didn't submit room
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("should create a private room", async () => {
            const onFinished = jest.fn();
            getComponent({ onFinished });
            await flushPromises();

            const roomName = "Test Room Name";
            fireEvent.change(screen.getByLabelText("Name"), { target: { value: roomName } });

            fireEvent.click(screen.getByText("Create room"));
            await flushPromises();

            expect(onFinished).toHaveBeenCalledWith(true, {
                createOpts: {
                    name: roomName,
                },
                encryption: true,
                parentSpace: undefined,
                roomType: undefined,
            });
        });
    });

    describe("for a knock room", () => {
        describe("when feature is disabled", () => {
            it("should not have the option to create a knock room", async () => {
                jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
                getComponent();
                fireEvent.click(screen.getByLabelText("Room visibility"));
                expect(screen.queryByRole("option", { name: "Ask to join" })).not.toBeInTheDocument();
            });
        });

        describe("when feature is enabled", () => {
            const onFinished = jest.fn();
            const roomName = "Test Room Name";

            beforeEach(async () => {
                onFinished.mockReset();
                jest.spyOn(SettingsStore, "getValue").mockImplementation(
                    (setting) => setting === "feature_ask_to_join",
                );
                getComponent({ onFinished });
                fireEvent.change(screen.getByLabelText("Name"), { target: { value: roomName } });
                fireEvent.click(screen.getByLabelText("Room visibility"));
                fireEvent.click(screen.getByRole("option", { name: "Ask to join" }));
            });

            it("should have a heading", () => {
                expect(screen.getByRole("heading")).toHaveTextContent("Create a room");
            });

            it("should have a hint", () => {
                expect(
                    screen.getByText(
                        "Anyone can request to join, but admins or moderators need to grant access. You can change this later.",
                    ),
                ).toBeInTheDocument();
            });

            it("should create a knock room with private visibility", async () => {
                fireEvent.click(screen.getByText("Create room"));
                await flushPromises();
                expect(onFinished).toHaveBeenCalledWith(true, {
                    createOpts: {
                        name: roomName,
                        visibility: Visibility.Private,
                    },
                    encryption: true,
                    joinRule: JoinRule.Knock,
                    parentSpace: undefined,
                    roomType: undefined,
                });
            });

            it("should create a knock room with public visibility", async () => {
                fireEvent.click(
                    screen.getByRole("checkbox", { name: "Make this room visible in the public room directory." }),
                );
                fireEvent.click(screen.getByText("Create room"));
                await flushPromises();
                expect(onFinished).toHaveBeenCalledWith(true, {
                    createOpts: {
                        name: roomName,
                        visibility: Visibility.Public,
                    },
                    encryption: true,
                    joinRule: JoinRule.Knock,
                    parentSpace: undefined,
                    roomType: undefined,
                });
            });
        });
    });

    describe("for a public room", () => {
        it("should set join rule to public defaultPublic is truthy", async () => {
            const onFinished = jest.fn();
            getComponent({ defaultPublic: true, onFinished });
            await flushPromises();

            expect(screen.getByText("Create a public room")).toBeInTheDocument();

            // e2e section is not rendered
            expect(screen.queryByText("Enable end-to-end encryption")).not.toBeInTheDocument();

            const roomName = "Test Room Name";
            fireEvent.change(screen.getByLabelText("Name"), { target: { value: roomName } });
        });

        it("should not create a public room without an alias", async () => {
            const onFinished = jest.fn();
            getComponent({ onFinished });
            await flushPromises();

            // set to public
            fireEvent.click(screen.getByLabelText("Room visibility"));
            fireEvent.click(screen.getByText("Public room"));
            expect(within(screen.getByLabelText("Room visibility")).findByText("Public room")).toBeTruthy();
            expect(screen.getByText("Create a public room")).toBeInTheDocument();

            // set name
            const roomName = "Test Room Name";
            fireEvent.change(screen.getByLabelText("Name"), { target: { value: roomName } });

            // try to create the room
            fireEvent.click(screen.getByText("Create room"));
            await flushPromises();

            // alias field invalid
            expect(screen.getByLabelText("Room address").parentElement!).toHaveClass("mx_Field_invalid");

            // didn't submit
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("should create a public room", async () => {
            const onFinished = jest.fn();
            getComponent({ onFinished, defaultPublic: true });
            await flushPromises();

            // set name
            const roomName = "Test Room Name";
            fireEvent.change(screen.getByLabelText("Name"), { target: { value: roomName } });

            const roomAlias = "test";

            fireEvent.change(screen.getByLabelText("Room address"), { target: { value: roomAlias } });

            // try to create the room
            fireEvent.click(screen.getByText("Create room"));
            await flushPromises();

            expect(onFinished).toHaveBeenCalledWith(true, {
                createOpts: {
                    name: roomName,
                    preset: Preset.PublicChat,
                    room_alias_name: roomAlias,
                    visibility: Visibility.Public,
                },
                guestAccess: false,
                parentSpace: undefined,
                roomType: undefined,
            });
        });
    });
});
