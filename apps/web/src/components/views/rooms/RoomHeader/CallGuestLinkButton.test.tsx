/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import React from "react";
import { fireEvent, getByLabelText, getByText, render, screen, waitFor } from "test-utils-rtl";
import { type EventTimeline, JoinRule, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { getMockClientWithEventEmitter, mockClientMethodsUser, TestSDKContext } from "test-utils";

import { SDKContext } from "../../../../contexts/SDKContext";
import { CallGuestLinkButton, JoinRuleDialog } from "./CallGuestLinkButton";
import Modal from "../../../../Modal";
import SdkConfig from "../../../../SdkConfig";
import { ShareDialog } from "../../dialogs/ShareDialog";
import { _t } from "../../../../languageHandler";
import SettingsStore from "../../../../settings/SettingsStore";

describe("<CallGuestLinkButton />", () => {
    const roomId = "!room:server.org";
    let sdkContext!: TestSDKContext;
    let modalSpy: Mocked<any>;
    let modalResolve: (value: unknown[] | PromiseLike<unknown[]>) => void;
    let room: Room;

    const targetUnencrypted =
        "https://guest_spa_url.com/room/#/!room:server.org?roomId=%21room%3Aserver.org&viaServers=example.org";
    const targetEncrypted =
        "https://guest_spa_url.com/room/#/!room:server.org?roomId=%21room%3Aserver.org&perParticipantE2EE=true&viaServers=example.org";
    const expectedShareDialogProps = {
        target: targetEncrypted,
        customTitle: "Conference invite link",
        subtitle: "Link for external users to join the call without a matrix account:",
    };

    /**
     * Create a room using mocked client
     * And mock isElementVideoRoom
     */
    const makeRoom = (isVideoRoom = true): Room => {
        const room = new Room(roomId, sdkContext.client!, sdkContext.client!.getSafeUserId());
        sdkContext.client!.getRoomDirectoryVisibility = vi.fn().mockResolvedValue("public");
        vi.spyOn(room, "isElementVideoRoom").mockReturnValue(isVideoRoom);
        // stub
        vi.spyOn(room, "getPendingEvents").mockReturnValue([]);
        vi.spyOn(room, "getVersion").mockReturnValue("9");
        return room;
    };
    function mockRoomMembers(room: Room, count: number) {
        const members = Array(count)
            .fill(0)
            .map((_, index) => ({
                userId: `@user-${index}:example.org`,
                roomId: room.roomId,
                membership: KnownMembership.Join,
            }));

        room.currentState.setJoinedMemberCount(members.length);
        room.getJoinedMembers = vi.fn().mockReturnValue(members);
    }

    const getComponent = (room: Room) =>
        render(<CallGuestLinkButton room={room} />, {
            wrapper: ({ children }) => <SDKContext.Provider value={sdkContext}>{children}</SDKContext.Provider>,
        });

    const oldGet = SdkConfig.get;
    beforeEach(() => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            sendStateEvent: vi.fn(),
            getVisibleRooms: vi.fn().mockReturnValue([]),
        });
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        const modalPromise = new Promise<unknown[]>((resolve) => {
            modalResolve = resolve;
        });
        modalSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({ finished: modalPromise, close: vi.fn() });
        room = makeRoom();
        mockRoomMembers(room, 3);

        vi.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (key === "element_call") {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://spa_url.com" };
            }
            return oldGet(key);
        });
        vi.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(true);
        vi.spyOn(sdkContext.roomViewStore, "isViewingCall").mockReturnValue(true);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("shows the JoinRuleDialog on click with private join rules", async () => {
        getComponent(room);
        fireEvent.click(screen.getByRole("button", { name: "Share call link" }));
        expect(modalSpy).toHaveBeenCalledWith(JoinRuleDialog, { room, canInvite: false });
        // pretend public was selected
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        modalResolve([]);
        await new Promise(process.nextTick);
        const callParams = modalSpy.mock.calls[1];
        expect(callParams[0]).toEqual(ShareDialog);
        expect(callParams[1].target.toString()).toEqual(expectedShareDialogProps.target);
        expect(callParams[1].subtitle).toEqual(expectedShareDialogProps.subtitle);
        expect(callParams[1].customTitle).toEqual(expectedShareDialogProps.customTitle);
    });

    it("shows the ShareDialog on click with public join rules", () => {
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        getComponent(room);
        fireEvent.click(screen.getByRole("button", { name: "Share call link" }));
        const callParams = modalSpy.mock.calls[0];
        expect(callParams[0]).toEqual(ShareDialog);
        expect(callParams[1].target.toString()).toEqual(expectedShareDialogProps.target);
        expect(callParams[1].subtitle).toEqual(expectedShareDialogProps.subtitle);
        expect(callParams[1].customTitle).toEqual(expectedShareDialogProps.customTitle);
    });

    it("shows the ShareDialog on click with knock join rules", () => {
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
        vi.spyOn(room, "canInvite").mockReturnValue(true);
        getComponent(room);
        fireEvent.click(screen.getByRole("button", { name: "Share call link" }));
        const callParams = modalSpy.mock.calls[0];
        expect(callParams[0]).toEqual(ShareDialog);
        expect(callParams[1].target.toString()).toEqual(expectedShareDialogProps.target);
        expect(callParams[1].subtitle).toEqual(expectedShareDialogProps.subtitle);
        expect(callParams[1].customTitle).toEqual(expectedShareDialogProps.customTitle);
    });

    it("don't show external conference button if room not public nor knock and the user cannot change join rules", () => {
        // preparation for if we refactor the related code to not use currentState.
        vi.spyOn(room, "getLiveTimeline").mockReturnValue({
            getState: vi.fn().mockReturnValue({
                maySendStateEvent: vi.fn().mockReturnValue(false),
            }),
        } as unknown as EventTimeline);
        vi.spyOn(room.currentState, "maySendStateEvent").mockReturnValue(false);
        getComponent(room);
        expect(screen.queryByLabelText("Share call link")).not.toBeInTheDocument();
    });

    it("don't show external conference button if now guest spa link is configured", () => {
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        vi.spyOn(sdkContext.roomViewStore, "isViewingCall").mockReturnValue(true);

        vi.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (key === "element_call") {
                return { url: "https://example2.com" };
            }
            return oldGet(key);
        });

        getComponent(room);
        // We only change the SdkConfig and show that this everything else is
        // configured so that the call link button is shown.
        expect(screen.queryByLabelText("Share call link")).not.toBeInTheDocument();

        vi.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (key === "element_call") {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://example2.com" };
            }
            return oldGet(key);
        });

        getComponent(room);
        expect(getByLabelText(document.body, "Share call link")).toBeInTheDocument();
    });

    it("opens the share dialog with the correct share link in an encrypted room", () => {
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        vi.spyOn(sdkContext.roomViewStore, "isViewingCall").mockReturnValue(true);

        getComponent(room);
        const modalSpy = vi.spyOn(Modal, "createDialog");
        fireEvent.click(getByLabelText(document.body, _t("voip|get_call_link")));
        // const target =
        //     "https://guest_spa_url.com/room/#/!room:server.org?roomId=%21room%3Aserver.org&perParticipantE2EE=true&viaServers=example.org";
        expect(modalSpy).toHaveBeenCalled();
        const arg0 = modalSpy.mock.calls[0][0];
        const arg1 = modalSpy.mock.calls[0][1] as any;
        expect(arg0).toEqual(ShareDialog);
        const { customTitle, subtitle } = arg1;
        expect({ customTitle, subtitle }).toEqual({
            customTitle: "Conference invite link",
            subtitle: _t("share|share_call_subtitle"),
        });
        expect(arg1.target.toString()).toEqual(targetEncrypted);
    });

    it("share dialog has correct link in an unencrypted room", () => {
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        vi.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(false);
        vi.spyOn(sdkContext.roomViewStore, "isViewingCall").mockReturnValue(true);

        getComponent(room);
        const modalSpy = vi.spyOn(Modal, "createDialog");
        fireEvent.click(getByLabelText(document.body, _t("voip|get_call_link")));
        const arg1 = modalSpy.mock.calls[0][1] as any;
        expect(arg1.target.toString()).toEqual(targetUnencrypted);
    });

    describe("<JoinRuleDialog />", () => {
        const onFinished = vi.fn();

        const getComponent = (room: Room, canInvite: boolean = true) =>
            render(<JoinRuleDialog room={room} canInvite={canInvite} onFinished={onFinished} />, {
                wrapper: ({ children }) => <SDKContext.Provider value={sdkContext}>{children}</SDKContext.Provider>,
            });

        beforeEach(() => {
            // feature_ask_to_join enabled
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        });

        it("shows ask to join if feature is enabled", () => {
            getComponent(room);
            expect(screen.getByRole("radio", { name: "Ask to join ( Recommended )" })).toBeInTheDocument();
        });
        it("dont show ask to join if feature is enabled but cannot invite", () => {
            getComponent(room, false);
            expect(screen.queryByRole("radio", { name: "Ask to join ( Recommended )" })).not.toBeInTheDocument();
        });
        it("doesn't show ask to join if feature is disabled", () => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            getComponent(room);
            expect(screen.queryByRole("radio", { name: "Ask to join ( Recommended )" })).not.toBeInTheDocument();
        });

        it("sends correct state event on click", async () => {
            const sendStateSpy = vi.spyOn(sdkContext.client!, "sendStateEvent");

            getComponent(room);
            fireEvent.click(screen.getByRole("radio", { name: "Ask to join ( Recommended )" }));
            expect(sendStateSpy).toHaveBeenCalledWith(
                "!room:server.org",
                "m.room.join_rules",
                { join_rule: "knock" },
                "",
            );
            expect(sendStateSpy).toHaveBeenCalledTimes(1);
            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1), { timeout: 3000 });
            onFinished.mockClear();
            sendStateSpy.mockClear();

            let container = getComponent(room).container;
            fireEvent.click(getByText(container, "Anyone"));
            expect(sendStateSpy).toHaveBeenLastCalledWith(
                "!room:server.org",
                "m.room.join_rules",
                { join_rule: "public" },
                "",
            );
            expect(sendStateSpy).toHaveBeenCalledTimes(1);
            container = getComponent(room).container;
            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1), { timeout: 3000 });
            onFinished.mockClear();
            sendStateSpy.mockClear();

            fireEvent.click(getByText(container, _t("update_room_access_modal|no_change")));
            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
            // Don't call sendStateEvent if no change is clicked.
            expect(sendStateSpy).toHaveBeenCalledTimes(0);
        });
    });
});
