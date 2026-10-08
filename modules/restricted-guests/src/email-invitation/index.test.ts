/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import type { Api, JoinRule, Room, RoomActionCallback } from "@element-hq/element-web-module-api";

import { initEmailInvitation } from "./index";
import { EmailInvitationFormDialog } from "./EmailInvitationFormDialog";
import { ErrorDialog } from "./ErrorDialog";
import { EmailInvitationSuccessDialog } from "./EmailInvitationSuccessDialog";
import type { ModuleConfig } from "../config";

interface RoomRights {
    canInvite: boolean;
    canChangeJoinRule: boolean;
    joinRule: JoinRule;
    supportsKnock?: boolean;
}

function makeRoom({ canInvite, canChangeJoinRule, joinRule, supportsKnock = true }: RoomRights): Room {
    return {
        id: "!room:example.org",
        name: { value: "Room" },
        canInvite: () => canInvite,
        canChangeJoinRule: () => canChangeJoinRule,
        supportsKnock: () => supportsKnock,
        joinRule: { value: joinRule },
        setJoinRule: vi.fn().mockResolvedValue(undefined),
    } as unknown as Room;
}

function setup(room: Room | null): { api: Api; callback: RoomActionCallback } {
    const api = {
        client: {
            getRoom: vi.fn().mockReturnValue(room),
            http: { authedRequest: vi.fn().mockResolvedValue({}) },
        },
        i18n: { translate: vi.fn((key: string) => key) },
        // Never resolve so the click stops at the first dialog
        openDialog: vi.fn().mockReturnValue({ finished: new Promise(() => {}) }),
        extras: {
            addRoomSummaryCardActionCallback: vi.fn(),
            addMemberListHeaderActionCallback: vi.fn(),
        },
    } as unknown as Api;
    initEmailInvitation(api, {} as ModuleConfig);

    const callback = vi.mocked(api.extras.addMemberListHeaderActionCallback).mock.calls[0][0];
    return { api, callback };
}

describe("initEmailInvitation", () => {
    it("adds the invite guest action to the room summary card and the member list header", () => {
        const { api, callback } = setup(null);
        expect(api.extras.addRoomSummaryCardActionCallback).toHaveBeenCalledWith(callback);
    });

    it("does not show the action for an unknown room", () => {
        const { callback } = setup(null);
        expect(callback("!room:example.org")).toBeUndefined();
    });

    it.each([
        { canInvite: true, canChangeJoinRule: false, joinRule: "knock", disabled: false },
        { canInvite: true, canChangeJoinRule: true, joinRule: "invite", disabled: false },
        { canInvite: false, canChangeJoinRule: true, joinRule: "knock", disabled: true },
        { canInvite: true, canChangeJoinRule: false, joinRule: "invite", disabled: true },
    ] satisfies (RoomRights & { disabled: boolean })[])(
        "disabled is $disabled when canInvite=$canInvite, canChangeJoinRule=$canChangeJoinRule and joinRule=$joinRule",
        ({ disabled, ...rights }) => {
            const { callback } = setup(makeRoom(rights));
            const action = callback("!room:example.org");

            expect(action?.disabled).toBe(disabled);
            expect(action?.disabledTooltip).toBe("invite_guest_disabled_tooltip");
        },
    );

    it.each([
        {
            supportsKnock: false,
            dialog: ErrorDialog,
            props: { lines: ["room_version_error_dialog_line_1", "room_version_error_dialog_line_2"] },
        },
        { supportsKnock: true, dialog: EmailInvitationFormDialog, props: {} },
    ])("opens $dialog.name when supportsKnock=$supportsKnock", ({ supportsKnock, dialog, props }) => {
        const room = makeRoom({ canInvite: true, canChangeJoinRule: true, joinRule: "invite", supportsKnock });
        const { api, callback } = setup(room);

        // The first dialog opens before onClick waits on anything
        callback("!room:example.org")?.onClick();

        expect(api.openDialog).toHaveBeenCalledTimes(1);
        expect(api.openDialog).toHaveBeenCalledWith(expect.anything(), dialog, expect.objectContaining(props));
    });

    describe("once the emails are confirmed", () => {
        const emails = ["alice@example.org", "bob@example.org"];

        function setupConfirmed(hasToChangeJoinRule = false): { api: Api; room: Room; callback: RoomActionCallback } {
            const room = makeRoom({ canInvite: true, canChangeJoinRule: true, joinRule: "knock" });
            const { api, callback } = setup(room);
            vi.mocked(api.openDialog).mockReturnValueOnce({
                finished: Promise.resolve({ ok: true, model: { emails, hasToChangeJoinRule } }),
                close: vi.fn(),
            });
            return { api, room, callback };
        }

        it("sends the invitations and shows the success dialog", async () => {
            const { api, room, callback } = setupConfirmed();

            callback("!room:example.org")?.onClick();

            await vi.waitFor(() =>
                expect(api.openDialog).toHaveBeenLastCalledWith(expect.anything(), EmailInvitationSuccessDialog, {
                    api,
                    emails,
                }),
            );
            expect(room.setJoinRule).not.toHaveBeenCalled();
            expect(api.client.http.authedRequest).toHaveBeenCalledWith("POST", "/invite_guests", {
                prefix: "/_synapse/client",
                body: { room_id: "!room:example.org", emails },
            });
        });

        it("changes the join rule to knock before sending the invitations", async () => {
            const { api, room, callback } = setupConfirmed(true);

            callback("!room:example.org")?.onClick();

            await vi.waitFor(() => expect(api.client.http.authedRequest).toHaveBeenCalled());
            expect(room.setJoinRule).toHaveBeenCalledWith("knock");
            expect(vi.mocked(room.setJoinRule).mock.invocationCallOrder[0]).toBeLessThan(
                vi.mocked(api.client.http.authedRequest).mock.invocationCallOrder[0],
            );
        });

        it("does nothing when the form dialog is cancelled", async () => {
            const room = makeRoom({ canInvite: true, canChangeJoinRule: true, joinRule: "knock" });
            const { api, callback } = setup(room);
            const finished = Promise.resolve({ ok: false, model: null });
            vi.mocked(api.openDialog).mockReturnValueOnce({ finished, close: vi.fn() });

            callback("!room:example.org")?.onClick();
            // onClick started waiting on the dialog first, so it has already handled the result once this resolves
            await finished;

            expect(api.client.http.authedRequest).not.toHaveBeenCalled();
            expect(api.openDialog).toHaveBeenCalledTimes(1);
        });

        it.each([
            { step: "changing the join rule", hasToChangeJoinRule: true },
            { step: "sending the invitations", hasToChangeJoinRule: false },
        ])("shows the error dialog when $step fails", async ({ hasToChangeJoinRule }) => {
            const { api, room, callback } = setupConfirmed(hasToChangeJoinRule);
            const failingCall = hasToChangeJoinRule ? room.setJoinRule : api.client.http.authedRequest;
            vi.mocked(failingCall).mockRejectedValue(new Error("Request failed"));
            vi.spyOn(console, "error").mockImplementation(() => {});

            callback("!room:example.org")?.onClick();

            await vi.waitFor(() =>
                expect(api.openDialog).toHaveBeenLastCalledWith(expect.anything(), ErrorDialog, {
                    api,
                    lines: ["invitation_email_dialog_error_line_1", "invitation_email_dialog_error_line_2"],
                }),
            );
            // The invitations are not sent if the join rule could not be changed
            if (hasToChangeJoinRule) expect(api.client.http.authedRequest).not.toHaveBeenCalled();
            expect(api.openDialog).not.toHaveBeenCalledWith(
                expect.anything(),
                EmailInvitationSuccessDialog,
                expect.anything(),
            );
        });
    });
});
