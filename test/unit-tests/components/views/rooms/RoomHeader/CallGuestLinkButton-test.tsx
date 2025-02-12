/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, getByLabelText, getByText, render, screen, waitFor } from "jest-matrix-react";
import { type EventTimeline, JoinRule, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { SDKContext, SdkContextClass } from "../../../../../../src/contexts/SDKContext";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";
import {
    CallGuestLinkButton,
    JoinRuleDialog,
} from "../../../../../../src/components/views/rooms/RoomHeader/CallGuestLinkButton";
import Modal from "../../../../../../src/Modal";
import SdkConfig from "../../../../../../src/SdkConfig";
import { ShareDialog } from "../../../../../../src/components/views/dialogs/ShareDialog";
import { _t } from "../../../../../../src/languageHandler";
import SettingsStore from "../../../../../../src/settings/SettingsStore";

describe("<CallGuestLinkButton />", () => {
    const roomId = "!room:server.org";
    let sdkContext!: SdkContextClass;
    let modalSpy: jest.SpyInstance;
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
        jest.spyOn(room, "isElementVideoRoom").mockReturnValue(isVideoRoom);
        // stub
        jest.spyOn(room, "getPendingEvents").mockReturnValue([]);
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
        room.getJoinedMembers = jest.fn().mockReturnValue(members);
    }

    const getComponent = (room: Room) =>
        render(<CallGuestLinkButton room={room} />, {
            wrapper: ({ children }) => <SDKContext.Provider value={sdkContext}>{children}</SDKContext.Provider>,
        });

    const oldGet = SdkConfig.get;
    beforeEach(() => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            sendStateEvent: jest.fn(),
        });
        sdkContext = new SdkContextClass();
        sdkContext.client = client;
        const modalPromise = new Promise<unknown[]>((resolve) => {
            modalResolve = resolve;
        });
        modalSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({ finished: modalPromise, close: jest.fn() });
        room = makeRoom();
        mockRoomMembers(room, 3);

        jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (key === "element_call") {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://spa_url.com" };
            }
            return oldGet(key);
        });
        jest.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(true);
        jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the JoinRuleDialog on click with private join rules", async () => {
        getComponent(room);
        fireEvent.click(screen.getByRole("button", { name: "Share call link" }));
        expect(modalSpy).toHaveBeenCalledWith(JoinRuleDialog, { room, canInvite: false });
        // pretend public was selected
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        modalResolve([]);
        await new Promise(process.nextTick);
        const callParams = modalSpy.mock.calls[1];
        expect(callParams[0]).toEqual(ShareDialog);
        expect(callParams[1].target.toString()).toEqual(expectedShareDialogProps.target);
        expect(callParams[1].subtitle).toEqual(expectedShareDialogProps.subtitle);
        expect(callParams[1].customTitle).toEqual(expectedShareDialogProps.customTitle);
    });

    it("shows the ShareDialog on click with public join rules", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        getComponent(room);
        fireEvent.click(screen.getByRole("button", { name: "Share call link" }));
        const callParams = modalSpy.mock.calls[0];
        expect(callParams[0]).toEqual(ShareDialog);
        expect(callParams[1].target.toString()).toEqual(expectedShareDialogProps.target);
        expect(callParams[1].subtitle).toEqual(expectedShareDialogProps.subtitle);
        expect(callParams[1].customTitle).toEqual(expectedShareDialogProps.customTitle);
    });

    it("shows the ShareDialog on click with knock join rules", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
        jest.spyOn(room, "canInvite").mockReturnValue(true);
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
        jest.spyOn(room, "getLiveTimeline").mockReturnValue({
            getState: jest.fn().mockReturnValue({
                maySendStateEvent: jest.fn().mockReturnValue(false),
            }),
        } as unknown as EventTimeline);
        jest.spyOn(room.currentState, "maySendStateEvent").mockReturnValue(false);
        getComponent(room);
        expect(screen.queryByLabelText("Share call link")).not.toBeInTheDocument();
    });

    it("don't show external conference button if now guest spa link is configured", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

        jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (key === "element_call") {
                return { url: "https://example2.com" };
            }
            return oldGet(key);
        });

        getComponent(room);
        // We only change the SdkConfig and show that this everything else is
        // configured so that the call link button is shown.
        expect(screen.queryByLabelText("Share call link")).not.toBeInTheDocument();

        jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (key === "element_call") {
                return { guest_spa_url: "https://guest_spa_url.com", url: "https://example2.com" };
            }
            return oldGet(key);
        });

        getComponent(room);
        expect(getByLabelText(document.body, "Share call link")).toBeInTheDocument();
    });

    it("opens the share dialog with the correct share link in an encrypted room", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

        getComponent(room);
        const modalSpy = jest.spyOn(Modal, "createDialog");
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
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        jest.spyOn(room, "hasEncryptionStateEvent").mockReturnValue(false);
        jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall").mockReturnValue(true);

        getComponent(room);
        const modalSpy = jest.spyOn(Modal, "createDialog");
        fireEvent.click(getByLabelText(document.body, _t("voip|get_call_link")));
        const arg1 = modalSpy.mock.calls[0][1] as any;
        expect(arg1.target.toString()).toEqual(targetUnencrypted);
    });

    describe("<JoinRuleDialog />", () => {
        const onFinished = jest.fn();

        const getComponent = (room: Room, canInvite: boolean = true) =>
            render(<JoinRuleDialog room={room} canInvite={canInvite} onFinished={onFinished} />, {
                wrapper: ({ children }) => <SDKContext.Provider value={sdkContext}>{children}</SDKContext.Provider>,
            });

        beforeEach(() => {
            // feature_ask_to_join enabled
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        });

        it("shows ask to join if feature is enabled", () => {
            const { container } = getComponent(room);
            expect(getByText(container, "Ask to join")).toBeInTheDocument();
        });
        it("font show ask to join if feature is enabled but cannot invite", () => {
            getComponent(room, false);
            expect(screen.queryByText("Ask to join")).not.toBeInTheDocument();
        });
        it("doesn't show ask to join if feature is disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            getComponent(room);
            expect(screen.queryByText("Ask to join")).not.toBeInTheDocument();
        });

        it("sends correct state event on click", async () => {
            const sendStateSpy = jest.spyOn(sdkContext.client!, "sendStateEvent");
            let container;
            container = getComponent(room).container;
            fireEvent.click(getByText(container, "Ask to join"));
            expect(sendStateSpy).toHaveBeenCalledWith(
                "!room:server.org",
                "m.room.join_rules",
                { join_rule: "knock" },
                "",
            );
            expect(sendStateSpy).toHaveBeenCalledTimes(1);
            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
            onFinished.mockClear();
            sendStateSpy.mockClear();

            container = getComponent(room).container;
            fireEvent.click(getByText(container, "Public"));
            expect(sendStateSpy).toHaveBeenLastCalledWith(
                "!room:server.org",
                "m.room.join_rules",
                { join_rule: "public" },
                "",
            );
            expect(sendStateSpy).toHaveBeenCalledTimes(1);
            container = getComponent(room).container;
            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
            onFinished.mockClear();
            sendStateSpy.mockClear();

            fireEvent.click(getByText(container, _t("update_room_access_modal|no_change")));
            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
            // Don't call sendStateEvent if no change is clicked.
            expect(sendStateSpy).toHaveBeenCalledTimes(0);
        });
    });
});
