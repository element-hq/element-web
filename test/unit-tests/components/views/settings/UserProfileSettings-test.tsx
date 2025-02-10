/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent } from "react";
import { act, render, screen } from "jest-matrix-react";
import { type MatrixClient, type UploadResponse } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";

import UserProfileSettings from "../../../../../src/components/views/settings/UserProfileSettings";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import { ToastContext, type ToastRack } from "../../../../../src/contexts/ToastContext";
import { OwnProfileStore } from "../../../../../src/stores/OwnProfileStore";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import dis from "../../../../../src/dispatcher/dispatcher";
import Modal from "../../../../../src/Modal";

interface MockedAvatarSettingProps {
    removeAvatar: () => void;
    onChange: (file: File) => void;
}

let removeAvatarFn: () => void;
let changeAvatarFn: (file: File) => void;

jest.mock(
    "../../../../../src/components/views/settings/AvatarSetting",
    () =>
        (({ removeAvatar, onChange }) => {
            removeAvatarFn = removeAvatar;
            changeAvatarFn = onChange;
            return <div>Mocked AvatarSetting</div>;
        }) as React.FC<MockedAvatarSettingProps>,
);

jest.mock("../../../../../src/dispatcher/dispatcher", () => ({
    dispatch: jest.fn(),
    register: jest.fn(),
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

jest.mock("@vector-im/compound-web", () => {
    const compound = jest.requireActual("@vector-im/compound-web");
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

const renderProfileSettings = (toastRack: Partial<ToastRack>, client: MatrixClient) => {
    return render(
        <TooltipProvider>
            <MatrixClientContext.Provider value={client}>
                <ToastContext.Provider value={toastRack}>
                    <UserProfileSettings canSetAvatar={true} canSetDisplayName={true} />
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
            displayToast: jest.fn().mockReturnValue(jest.fn()),
        };
    });

    it("removes avatar", async () => {
        jest.spyOn(OwnProfileStore.instance, "avatarMxc", "get").mockReturnValue("mxc://example.org/my-avatar");
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
        mocked(client).uploadContent.mockResolvedValue({ content_uri: returnedMxcUri });

        const fileSentinel = {};
        await act(async () => {
            await changeAvatarFn(fileSentinel as File);
        });

        expect(client.uploadContent).toHaveBeenCalledWith(fileSentinel);
        expect(client.setAvatarUrl).toHaveBeenCalledWith(returnedMxcUri);
    });

    it("displays toast while uploading avatar", async () => {
        renderProfileSettings(toastRack, client);

        const clearToastFn = jest.fn();
        mocked(toastRack.displayToast!).mockReturnValue(clearToastFn);

        expect(await screen.findByText("Mocked AvatarSetting")).toBeInTheDocument();
        expect(changeAvatarFn).toBeDefined();

        let resolveUploadPromise = (r: UploadResponse) => {};
        const uploadPromise = new Promise<UploadResponse>((r) => {
            resolveUploadPromise = r;
        });
        mocked(client).uploadContent.mockReturnValue(uploadPromise);

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
        jest.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");

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
        jest.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");
        mocked(client).setDisplayName.mockRejectedValue(new Error("Failed to set display name"));

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
        jest.spyOn(OwnProfileStore.instance, "displayName", "get").mockReturnValue("Alice");

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

    it("signs out directly if no rooms are encrypted", async () => {
        renderProfileSettings(toastRack, client);

        const signOutButton = await screen.findByText("Sign out");
        await userEvent.click(signOutButton);

        expect(dis.dispatch).toHaveBeenCalledWith({ action: "logout" });
    });

    it("displays confirmation dialog if rooms are encrypted", async () => {
        jest.spyOn(Modal, "createDialog");

        const mockRoom = mkStubRoom("!test:room", "Test Room", client);
        client.getRooms = jest.fn().mockReturnValue([mockRoom]);
        client.getCrypto = jest.fn().mockReturnValue({
            isEncryptionEnabledInRoom: jest.fn().mockReturnValue(true),
        });

        renderProfileSettings(toastRack, client);

        const signOutButton = await screen.findByText("Sign out");
        await userEvent.click(signOutButton);

        expect(Modal.createDialog).toHaveBeenCalled();
    });
});
