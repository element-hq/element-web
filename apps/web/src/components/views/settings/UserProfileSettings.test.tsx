/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { type ChangeEvent } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "test-utils-rtl";
import { mkStubRoom, stubClient } from "test-utils";
import { type MatrixClient, type UploadResponse } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";
import { ToastContext, type ToastRack } from "@element-hq/web-shared-components";

import UserProfileSettings from "./UserProfileSettings";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";

interface MockedAvatarSettingProps {
    removeAvatar: () => void;
    onChange: (file: File) => void;
}

let removeAvatarFn: () => void;
let changeAvatarFn: (file: File) => void;

vi.mock("./AvatarSetting", () => ({
    default: (({ removeAvatar, onChange }) => {
        removeAvatarFn = removeAvatar;
        changeAvatarFn = onChange;
        return <div>Mocked AvatarSetting</div>;
    }) as React.FC<MockedAvatarSettingProps>,
}));

vi.mock("../../../dispatcher/dispatcher", () => ({
    default: {
        dispatch: vi.fn(),
        register: vi.fn(),
    },
}));

let editInPlaceOnChange: (e: ChangeEvent<HTMLInputElement>) => void;
let editInPlaceOnSave: () => void;
let editInPlaceOnCancel: () => void;

interface MockedEditInPlaceProps {
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCancel: () => void;
    value: string;
}

vi.mock("@vector-im/compound-web", async () => {
    const compound = await vi.importActual("@vector-im/compound-web");
    return {
        __esModule: true,
        ...compound,
        EditInPlace: (({ onChange, onSave, onCancel, value }) => {
            editInPlaceOnChange = onChange;
            editInPlaceOnSave = onSave;
            editInPlaceOnCancel = onCancel;
            return <div>Mocked EditInPlace: {value}</div>;
        }) as React.FC<MockedEditInPlaceProps>,
    };
});

const renderProfileSettings = (
    toastRack: Partial<ToastRack>,
    client: MatrixClient,
    { startCustomStatus }: { startCustomStatus?: boolean } = {},
) => {
    return render(
        <TooltipProvider>
            <MatrixClientContext.Provider value={client}>
                <ToastContext.Provider value={toastRack as ToastRack}>
                    <UserProfileSettings
                        canSetAvatar={true}
                        canSetDisplayName={true}
                        startCustomStatus={startCustomStatus}
                    />
                </ToastContext.Provider>
            </MatrixClientContext.Provider>
        </TooltipProvider>,
    );
};

describe("ProfileSettings", () => {
    let client: MatrixClient;
    let toastRack: Partial<ToastRack>;

    beforeEach(() => {
        client = stubClient();
        toastRack = {
            displayToast: vi.fn().mockReturnValue(vi.fn()),
        };
    });

    it("shows the custom status editor when startCustomStatus is set", async () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name) => name === "feature_user_status");

        renderProfileSettings(toastRack, client, { startCustomStatus: true });

        expect(await screen.findByRole("textbox", { name: "What's your status?" })).toBeInTheDocument();
    });

    it("removes avatar", async () => {
        vi.spyOn(OwnProfileStore.instance, "avatarMxc", "get").mockReturnValue("mxc://example.org/my-avatar");
        renderProfileSettings(toastRack, client);

        expect(await screen.findByText("Mocked AvatarSetting")).toBeInTheDocument();
        expect(removeAvatarFn).toBeDefined();

        act(() => {
            removeAvatarFn();
        });

        expect(client.setAvatarUrl).toHaveBeenCalledWith("");
    });

    it("changes avatar", async () => {
        renderProfileSettings(toastRack, client);

        expect(await screen.findByText("Mocked AvatarSetting")).toBeInTheDocument();
        expect(changeAvatarFn).toBeDefined();

        const returnedMxcUri = "mxc://example.org/my-avatar";
        vi.mocked(client).uploadContent.mockResolvedValue({ content_uri: returnedMxcUri });

        const fileSentinel = {};
        await act(async () => {
            await changeAvatarFn(fileSentinel as File);
        });

        expect(client.uploadContent).toHaveBeenCalledWith(fileSentinel);
        expect(client.setAvatarUrl).toHaveBeenCalledWith(returnedMxcUri);
    });

    it("displays toast while uploading avatar", async () => {
        renderProfileSettings(toastRack, client);

        const clearToastFn = vi.fn();
        vi.mocked(toastRack.displayToast!).mockReturnValue(clearToastFn);

        expect(await screen.findByText("Mocked AvatarSetting")).toBeInTheDocument();
        expect(changeAvatarFn).toBeDefined();

        let resolveUploadPromise = (r: UploadResponse) => {};
        const uploadPromise = new Promise<UploadResponse>((r) => {
            resolveUploadPromise = r;
        });
        vi.mocked(client).uploadContent.mockReturnValue(uploadPromise);

        const fileSentinel = {};
        const changeAvatarActPromise = act(async () => {
            await changeAvatarFn(fileSentinel as File);
        });

        expect(toastRack.displayToast).toHaveBeenCalled();

        act(() => {
            resolveUploadPromise({ content_uri: "bloop" });
        });
        await changeAvatarActPromise;

        expect(clearToastFn).toHaveBeenCalled();
    });

    it("changes display name", async () => {
        vi.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");

        renderProfileSettings(toastRack, client);

        expect(await screen.findByText("Mocked EditInPlace: Alice")).toBeInTheDocument();
        expect(editInPlaceOnSave).toBeDefined();

        act(() => {
            editInPlaceOnChange({
                target: { value: "The Value" } as HTMLInputElement,
            } as ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
            await editInPlaceOnSave();
        });

        expect(client.setDisplayName).toHaveBeenCalledWith("The Value");
    });

    it("displays error if changing display name fails", async () => {
        vi.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");
        vi.mocked(client).setDisplayName.mockRejectedValue(new Error("Failed to set display name"));

        renderProfileSettings(toastRack, client);

        expect(editInPlaceOnSave).toBeDefined();

        act(() => {
            editInPlaceOnChange({
                target: { value: "Not Alice any more" } as HTMLInputElement,
            } as ChangeEvent<HTMLInputElement>);
        });

        await act(async () => {
            await expect(editInPlaceOnSave()).rejects.toEqual(expect.any(Error));
        });
    });

    it("resets on cancel", async () => {
        vi.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");

        renderProfileSettings(toastRack, client);

        expect(await screen.findByText("Mocked EditInPlace: Alice")).toBeInTheDocument();
        expect(editInPlaceOnChange).toBeDefined();
        expect(editInPlaceOnCancel).toBeDefined();

        act(() => {
            editInPlaceOnChange({
                target: { value: "Alicia Zattic" } as HTMLInputElement,
            } as ChangeEvent<HTMLInputElement>);
        });

        expect(await screen.findByText("Mocked EditInPlace: Alicia Zattic")).toBeInTheDocument();

        act(() => {
            editInPlaceOnCancel();
        });

        expect(await screen.findByText("Mocked EditInPlace: Alice")).toBeInTheDocument();
    });

    it("displays confirmation dialog if no rooms are encrypted", async () => {
        vi.spyOn(Modal, "createDialog");

        renderProfileSettings(toastRack, client);

        const signOutButton = await screen.findByText("Remove this device");
        await userEvent.click(signOutButton);

        expect(Modal.createDialog).toHaveBeenCalled();
    });

    it("displays confirmation dialog if rooms are encrypted", async () => {
        vi.spyOn(Modal, "createDialog");

        const mockRoom = mkStubRoom("!test:room", "Test Room", client);
        client.getRooms = vi.fn().mockReturnValue([mockRoom]);
        client.getCrypto = vi.fn().mockReturnValue({
            isEncryptionEnabledInRoom: vi.fn().mockReturnValue(true),
            getUserDeviceInfo: vi.fn().mockResolvedValue(new Map()),
        });

        renderProfileSettings(toastRack, client);

        const signOutButton = await screen.findByText("Remove this device");
        await userEvent.click(signOutButton);

        expect(Modal.createDialog).toHaveBeenCalled();
    });
});
