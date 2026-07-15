/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { ChatBackgroundPanel } from "../../../../../src/components/views/settings/ChatBackgroundPanel";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";

describe("<ChatBackgroundPanel />", () => {
    let client: MatrixClient;
    let settings: Record<string, unknown>;
    let setValueSpy: jest.SpyInstance;

    beforeEach(() => {
        client = stubClient();
        settings = {
            "RoomView.backgroundImage": null,
            "RoomView.backgroundOpacity": 1,
        };
        const realGetValue = SettingsStore.getValue.bind(SettingsStore);
        jest.spyOn(SettingsStore, "getValue").mockImplementation(((name: string, ...rest: unknown[]) =>
            name in settings
                ? settings[name]
                : (realGetValue as (...args: unknown[]) => unknown)(name, ...rest)) as typeof SettingsStore.getValue);
        setValueSpy = jest
            .spyOn(SettingsStore, "setValue")
            .mockImplementation(async (name: string, _roomId, _level, value: unknown) => {
                settings[name] = value;
            });
    });

    afterEach(() => jest.restoreAllMocks());

    const renderPanel = (): ReturnType<typeof render> =>
        render(
            <MatrixClientContext.Provider value={client}>
                <ChatBackgroundPanel />
            </MatrixClientContext.Provider>,
        );

    it("renders the preset options", () => {
        renderPanel();
        for (const name of ["None", "Doodles", "Paper", "Meadow", "Dusk glow", "Night sky", "Fern"]) {
            expect(screen.getByRole("radio", { name })).toBeInTheDocument();
        }
    });

    it("selects None by default", () => {
        renderPanel();
        expect(screen.getByRole("radio", { name: "None" })).toBeChecked();
    });

    it("shows a stored legacy preset id as its successor tile", () => {
        // Account data written by the first-generation presets must keep selecting a tile
        // rather than leaving the rail looking like nothing is chosen.
        settings["RoomView.backgroundImage"] = "dots";
        renderPanel();
        expect(screen.getByRole("radio", { name: "Doodles" })).toBeChecked();
    });

    it("writes the chosen preset at the account level", async () => {
        renderPanel();
        act(() => screen.getByRole("radio", { name: "Doodles" }).click());
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundImage", null, SettingLevel.ACCOUNT, "doodle"),
        );
    });

    it("clears the background when None is chosen", async () => {
        settings["RoomView.backgroundImage"] = "doodle";
        renderPanel();
        act(() => screen.getByRole("radio", { name: "None" }).click());
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundImage", null, SettingLevel.ACCOUNT, null),
        );
    });

    it("writes the opacity once the slider is released", async () => {
        settings["RoomView.backgroundImage"] = "doodle";
        renderPanel();
        const slider = screen.getByRole("slider");
        fireEvent.change(slider, { target: { value: "0.5" } });
        fireEvent.pointerUp(slider);
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundOpacity", null, SettingLevel.ACCOUNT, 0.5),
        );
    });

    it("does not write while the slider is still being dragged", async () => {
        // Each write is an account-data round trip that rebuilds the whole settings event, so persisting per
        // increment would both hammer the homeserver and let a slow echo clobber a newer choice.
        settings["RoomView.backgroundImage"] = "doodle";
        renderPanel();
        const slider = screen.getByRole("slider");
        for (const value of ["0.9", "0.8", "0.7", "0.6", "0.5"]) {
            fireEvent.change(slider, { target: { value } });
        }

        expect(setValueSpy).not.toHaveBeenCalledWith(
            "RoomView.backgroundOpacity",
            null,
            SettingLevel.ACCOUNT,
            expect.anything(),
        );
        // The dial still tracks the drag, it just isn't persisted yet.
        expect(slider).toHaveValue("0.5");

        fireEvent.pointerUp(slider);
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundOpacity", null, SettingLevel.ACCOUNT, 0.5),
        );
        expect(setValueSpy.mock.calls.filter(([name]) => name === "RoomView.backgroundOpacity")).toHaveLength(1);
    });

    it("commits the opacity when the slider is adjusted with the keyboard", async () => {
        settings["RoomView.backgroundImage"] = "doodle";
        renderPanel();
        const slider = screen.getByRole("slider");
        fireEvent.change(slider, { target: { value: "0.75" } });
        fireEvent.keyUp(slider, { key: "ArrowLeft" });
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundOpacity", null, SettingLevel.ACCOUNT, 0.75),
        );
    });

    it("disables the opacity slider when no background is set", () => {
        renderPanel();
        expect(screen.getByRole("slider")).toBeDisabled();
    });

    it("falls back to None for a preset id it does not know", () => {
        // A preset added by a newer client paints nothing, so the rail has to agree rather than leave every
        // tile unchecked with the opacity dial still live.
        settings["RoomView.backgroundImage"] = "future-pattern";
        renderPanel();
        expect(screen.getByRole("radio", { name: "None" })).toBeChecked();
        expect(screen.getByRole("slider")).toBeDisabled();
    });

    it("clamps an out-of-range stored opacity for display", () => {
        settings["RoomView.backgroundImage"] = "doodle";
        settings["RoomView.backgroundOpacity"] = -5;
        renderPanel();
        expect(screen.getByRole("slider")).toHaveValue(String(0.1));
    });

    it("shows an error when the opacity write fails", async () => {
        settings["RoomView.backgroundImage"] = "doodle";
        setValueSpy.mockRejectedValue(new Error("nope"));
        renderPanel();
        const slider = screen.getByRole("slider");
        fireEvent.change(slider, { target: { value: "0.5" } });
        fireEvent.pointerUp(slider);
        expect(await screen.findByText("Couldn't save your chat background. Please try again.")).toBeInTheDocument();
    });

    it("uploads a custom image and stores its mxc uri", async () => {
        mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/uploaded" });
        renderPanel();
        const file = new File(["x"], "wallpaper.png", { type: "image/png" });
        fireEvent.change(screen.getByTestId("chatBackgroundUpload"), { target: { files: [file] } });

        await waitFor(() => expect(client.uploadContent).toHaveBeenCalledWith(file));
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith(
                "RoomView.backgroundImage",
                null,
                SettingLevel.ACCOUNT,
                "mxc://server/uploaded",
            ),
        );
    });

    it("shows an error when the upload fails", async () => {
        mocked(client.uploadContent).mockRejectedValue(new Error("boom"));
        renderPanel();
        const file = new File(["x"], "wallpaper.png", { type: "image/png" });
        fireEvent.change(screen.getByTestId("chatBackgroundUpload"), { target: { files: [file] } });

        expect(await screen.findByText("Couldn't upload image. Please try again.")).toBeInTheDocument();
    });

    it("offers to remove a custom uploaded image", async () => {
        settings["RoomView.backgroundImage"] = "mxc://server/custom";
        renderPanel();
        expect(screen.getByRole("radio", { name: "Custom image" })).toBeInTheDocument();

        act(() => screen.getByRole("button", { name: "Remove" }).click());
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundImage", null, SettingLevel.ACCOUNT, null),
        );
    });

    it("keeps the uploaded image in the rail after switching to a preset", async () => {
        mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/uploaded" });
        renderPanel();
        const file = new File(["x"], "wallpaper.png", { type: "image/png" });
        fireEvent.change(screen.getByTestId("chatBackgroundUpload"), { target: { files: [file] } });

        expect(await screen.findByRole("radio", { name: "Custom image" })).toBeInTheDocument();

        act(() => screen.getByRole("radio", { name: "Doodles" }).click());
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith("RoomView.backgroundImage", null, SettingLevel.ACCOUNT, "doodle"),
        );

        // Picking a preset must not strand the upload: its tile stays, and choosing it again writes the
        // remembered mxc back rather than doing nothing.
        expect(screen.getByRole("radio", { name: "Custom image" })).toBeInTheDocument();
        act(() => screen.getByRole("radio", { name: "Custom image" }).click());
        await waitFor(() =>
            expect(setValueSpy).toHaveBeenCalledWith(
                "RoomView.backgroundImage",
                null,
                SettingLevel.ACCOUNT,
                "mxc://server/uploaded",
            ),
        );
    });

    it("shows the chosen tile before the account data echoes back", async () => {
        renderPanel();
        expect(screen.getByRole("radio", { name: "None" })).toBeChecked();

        act(() => screen.getByRole("radio", { name: "Doodles" }).click());

        // The setting is account-level, so `useSettingValue` only reports the new value once the homeserver
        // echoes it back -- which never happens here. The tile must show the click regardless, or the
        // selection would snap back on every pick and never move at all while offline.
        await waitFor(() => expect(screen.getByRole("radio", { name: "Doodles" })).toBeChecked());
        expect(screen.getByRole("radio", { name: "None" })).not.toBeChecked();
    });

    it("reverts the selection when the write fails", async () => {
        setValueSpy.mockRejectedValueOnce(new Error("offline"));
        renderPanel();

        act(() => screen.getByRole("radio", { name: "Doodles" }).click());

        await waitFor(() => expect(screen.getByRole("radio", { name: "None" })).toBeChecked());
        expect(screen.getByRole("radio", { name: "Doodles" })).not.toBeChecked();
    });
});
