/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "test-utils-rtl";
import { RoomMember, User, RoomEvent, RoomStateEvent, type RoomState } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import userEvent from "@testing-library/user-event";

import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { ModuleApi } from "../../../../modules/Api";
import { type Rendered, renderMemberList } from "./__mocks__";

vi.mock("../../../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1500);
vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1500);

describe("Does not render invite button in memberlist header", () => {
    it("when user is not a member", async () => {
        await renderMemberList(true, (room) => room.updateMyMembership(KnownMembership.Leave));
        expect(screen.queryByRole("button", { name: "Invite" })).toBeNull();
    });

    it("when UI customisation hides invites", async () => {
        vi.mocked(shouldShowComponent).mockReturnValue(false);
        const { client, memberListRoom } = await renderMemberList(true);
        // Needs this specific event...
        act(() => {
            client.emit(RoomEvent.MyMembership, memberListRoom, KnownMembership.Join, KnownMembership.Invite);
        });
        await waitFor(() => expect(screen.queryByRole("button", { name: "Invite" })).toBeNull());
    });
});

describe("MemberListHeaderView", () => {
    let rendered: Rendered;

    beforeEach(async function () {
        vi.mocked(shouldShowComponent).mockReturnValue(true);
        rendered = await renderMemberList(true);
    });

    it("Shows the correct member count", async () => {
        expect(await screen.findByText("6 Members")).toBeVisible();
    });

    it("Does not show search box when there's less than 20 members", async () => {
        expect(screen.queryByPlaceholderText("Search room members")).toBeNull();
    });

    it("Shows search box when there's more than 20 members", async () => {
        const { memberListRoom, client, reRender } = rendered;
        // Memberlist already has 6 members, add 14 more to make the total 20
        for (let i = 0; i < 14; ++i) {
            const newMember = new RoomMember(memberListRoom.roomId, `@new${i}:localhost`);
            newMember.membership = KnownMembership.Join;
            newMember.powerLevel = 0;
            newMember.user = User.createUser(newMember.userId, client);
            newMember.user.currentlyActive = true;
            newMember.user.presence = "online";
            newMember.user.lastPresenceTs = 1000;
            newMember.user.lastActiveAgo = 10;
            memberListRoom.currentState.members[newMember.userId] = newMember;
        }
        await reRender();
        await waitFor(() => expect(screen.queryByPlaceholderText("Search room members")).toBeVisible());
    });

    describe("Invite button functionality", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("Renders disabled invite button when current user is a member but does not have rights to invite", async () => {
            const { memberListRoom, reRender } = rendered;
            vi.spyOn(memberListRoom, "getMyMembership").mockReturnValue(KnownMembership.Join);
            vi.spyOn(memberListRoom, "canInvite").mockReturnValue(false);
            await reRender();
            await waitFor(() =>
                expect(screen.getByRole("button", { name: "Invite" })).toHaveAttribute("aria-disabled", "true"),
            );
        });

        it("Renders enabled invite button when current user is a member and has rights to invite", async () => {
            const { memberListRoom, reRender } = rendered;
            vi.spyOn(memberListRoom, "getMyMembership").mockReturnValue(KnownMembership.Join);
            vi.spyOn(memberListRoom, "canInvite").mockReturnValue(true);
            await reRender();
            await waitFor(() =>
                expect(screen.getByRole("button", { name: "Invite" })).not.toHaveAttribute("aria-disabled", "true"),
            );
        });

        it("Updates the invite button when a power level change grants invite rights", async () => {
            const { memberListRoom, client, reRender } = rendered;
            vi.spyOn(memberListRoom, "getMyMembership").mockReturnValue(KnownMembership.Join);
            vi.spyOn(memberListRoom, "canInvite").mockReturnValue(false);
            await reRender();
            await waitFor(() =>
                expect(screen.getByRole("button", { name: "Invite" })).toHaveAttribute("aria-disabled", "true"),
            );

            // Grant the right to invite, and announce it the way a power level change does
            vi.spyOn(memberListRoom, "canInvite").mockReturnValue(true);
            act(() => {
                client.emit(RoomStateEvent.Update, { roomId: memberListRoom.roomId } as RoomState);
            });

            await waitFor(() =>
                expect(screen.getByRole("button", { name: "Invite" })).not.toHaveAttribute("aria-disabled", "true"),
            );
        });

        it("Opens room inviter on button click", async () => {
            const { memberListRoom, reRender } = rendered;
            vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
            vi.spyOn(memberListRoom, "canInvite").mockReturnValue(true);
            await reRender();

            await waitFor(() => expect(screen.getByRole("button", { name: "Invite" })).not.toBeDisabled());
            fireEvent.click(screen.getByRole("button", { name: "Invite" }));
            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                action: "view_invite",
                roomId: memberListRoom.roomId,
            });
        });
    });
});

describe("Module actions in memberlist header", () => {
    const onClick = vi.fn();
    const action = { key: "action", label: "Module action", icon: () => null, onClick };
    const disabledAction = { ...action, disabled: true, disabledTooltip: "You can't invite guests" };
    const callback = vi.fn();

    beforeEach(() => {
        vi.mocked(shouldShowComponent).mockReturnValue(true);
        callback.mockReturnValue(action);
        ModuleApi.instance.extras.addMemberListHeaderActionCallback(callback);
    });

    afterEach(() => {
        ModuleApi.instance.extras.memberListHeaderActionCallbacks = [];
    });

    it("renders the module action next to the invite button", async () => {
        // The module action stays enabled even when the user can't invite: only the module disables it
        const { memberListRoom } = await renderMemberList(true, (room) => {
            vi.spyOn(room, "canInvite").mockReturnValue(false);
        });

        const button = await screen.findByRole("button", { name: "Module action" });
        expect(button).not.toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Invite" })).toBeVisible();
        expect(callback).toHaveBeenCalledWith(memberListRoom.roomId);

        fireEvent.click(button);
        expect(onClick).toHaveBeenCalled();
    });

    it("shows the module tooltip when the module disables the action", async () => {
        callback.mockReturnValue(disabledAction);
        await renderMemberList(true);

        const button = await screen.findByRole("button", { name: "Module action" });
        expect(button).toHaveAttribute("aria-disabled", "true");
        await userEvent.hover(button);
        expect(await screen.findByRole("tooltip")).toHaveTextContent("You can't invite guests");
    });

    it("renders the module action when the invite button is hidden", async () => {
        await renderMemberList(true, (room) => room.updateMyMembership(KnownMembership.Leave));

        expect(await screen.findByRole("button", { name: "Module action" })).toBeVisible();
        expect(screen.queryByRole("button", { name: "Invite" })).toBeNull();
    });

    it("renders the module action as an icon next to the search box", async () => {
        callback.mockReturnValue(disabledAction);
        const { memberListRoom, client, reRender } = await renderMemberList(true);
        // Memberlist already has 6 members, add 14 more to make the total 20
        for (let i = 0; i < 14; ++i) {
            const newMember = new RoomMember(memberListRoom.roomId, `@new${i}:localhost`);
            newMember.membership = KnownMembership.Join;
            newMember.user = User.createUser(newMember.userId, client);
            memberListRoom.currentState.members[newMember.userId] = newMember;
        }
        await reRender();

        await waitFor(() => expect(screen.getByPlaceholderText("Search room members")).toBeVisible());
        const button = screen.getByRole("button", { name: "Module action" });
        expect(button).not.toHaveTextContent("Module action");
        expect(button).toHaveAttribute("aria-disabled", "true");
        await userEvent.hover(button);
        expect(await screen.findByRole("tooltip")).toHaveTextContent("You can't invite guests");
    });

    it("does not show a tooltip when the module disables the action without a reason", async () => {
        callback.mockReturnValue({ ...action, disabled: true });
        await renderMemberList(true);

        const button = await screen.findByRole("button", { name: "Module action" });
        expect(button).toHaveAttribute("aria-disabled", "true");
        await userEvent.hover(button);
        await expect(screen.findByRole("tooltip", {}, { timeout: 500 })).rejects.toThrow();
    });
});
