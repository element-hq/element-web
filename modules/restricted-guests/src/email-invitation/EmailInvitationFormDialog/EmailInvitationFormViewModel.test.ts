/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { type Api, type JoinRule, type Room } from "@element-hq/element-web-module-api";
import { copyPlainTextToClipboard } from "@element-hq/element-web-shared-utils";

import { EmailInvitationFormViewModel } from "./EmailInvitationFormViewModel";
import { type ModuleConfig } from "../../config";
import { type EmailInvitationFormResult } from "./types";

vi.mock("@element-hq/element-web-shared-utils", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@element-hq/element-web-shared-utils")>()),
    copyPlainTextToClipboard: vi.fn().mockResolvedValue(true),
}));

const makeViewModel = (
    joinRule = "knock",
    allowCopyInviteLink = false,
): {
    vm: EmailInvitationFormViewModel;
    room: Room;
    onSubmit: (result: EmailInvitationFormResult) => void;
    closeDialog: () => void;
} => {
    const room = {
        joinRule: { value: joinRule, watch: vi.fn(), unwatch: vi.fn() },
        setJoinRule: vi.fn(),
        getPermalink: vi.fn().mockReturnValue("https://matrix.to/#/!room:example.org"),
    } as unknown as Room;

    const onSubmit = vi.fn();
    const closeDialog = vi.fn();

    const vm = new EmailInvitationFormViewModel({
        api: {} as Api,
        room,
        config: { allow_copy_invite_link: allowCopyInviteLink } as ModuleConfig,
        closeDialog,
        onSubmit,
    });
    return { vm, room, onSubmit, closeDialog };
};

describe("EmailInvitationFormViewModel", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("should build the initial snapshot from the room and the config", () => {
        expect(makeViewModel("knock", false).vm.getSnapshot()).toMatchObject({
            isJoinRuleChangeRequired: false,
            canCopyLinkToClipboard: false,
        });
        expect(makeViewModel("invite", true).vm.getSnapshot()).toMatchObject({
            isJoinRuleChangeRequired: true,
            canCopyLinkToClipboard: true,
        });
    });

    it("should follow the room join rule until disposed", () => {
        const { vm, room } = makeViewModel("knock");
        const onJoinRuleChange = vi.mocked(room.joinRule.watch).mock.calls[0][0] as (joinRule: JoinRule) => void;

        onJoinRuleChange("invite");
        expect(vm.getSnapshot().isJoinRuleChangeRequired).toBe(true);
        onJoinRuleChange("knock");
        expect(vm.getSnapshot().isJoinRuleChangeRequired).toBe(false);

        vm.dispose();
        expect(room.joinRule.unwatch).toHaveBeenCalledWith(onJoinRuleChange);
    });

    it("should validate the added emails", () => {
        const { vm } = makeViewModel();

        vm.addEmail("alice@example.com");
        expect(vm.getSnapshot().emails).toEqual([{ text: "alice@example.com", isValid: true }]);
        expect(vm.getSnapshot().canSendInvitations).toBe(true);

        vm.addEmail("not an email");
        expect(vm.getSnapshot().emails[1]).toEqual({ text: "not an email", isValid: false });
        expect(vm.getSnapshot().canSendInvitations).toBe(false);

        // Removing the invalid email allows sending again
        vm.removeEmail(1);
        expect(vm.getSnapshot().canSendInvitations).toBe(true);
    });

    it("should not submit without emails", () => {
        const { vm, onSubmit } = makeViewModel();

        vm.sendInvitations();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should submit the emails without changing the join rule when the room is already knock", () => {
        const { vm, onSubmit } = makeViewModel("knock");
        vm.addEmail("alice@example.com");

        vm.sendInvitations();
        expect(onSubmit).toHaveBeenCalledWith({ emails: ["alice@example.com"], hasToChangeJoinRule: false });
    });

    it("should submit the emails and the join rule change", () => {
        const { vm, onSubmit } = makeViewModel("invite");
        vm.addEmail("alice@example.com");
        vm.addEmail("bob@example.com");

        // The join rule change must be confirmed first
        vm.sendInvitations();
        expect(onSubmit).not.toHaveBeenCalled();

        vm.toggleJoinRuleConfirmed();
        vm.sendInvitations();
        expect(onSubmit).toHaveBeenCalledWith({
            emails: ["alice@example.com", "bob@example.com"],
            hasToChangeJoinRule: true,
        });
    });

    it("should copy the room link and show the tooltip for 5 seconds", async () => {
        vi.useFakeTimers();
        const { vm } = makeViewModel("knock", true);

        await vm.copyLinkToClipboard();
        expect(copyPlainTextToClipboard).toHaveBeenCalledWith("https://matrix.to/#/!room:example.org");
        expect(vm.getSnapshot().displayCopyTooltip).toBe(true);

        vi.advanceTimersByTime(5000);
        expect(vm.getSnapshot().displayCopyTooltip).toBe(false);
    });

    it("should close the dialog", () => {
        const { vm, closeDialog } = makeViewModel();

        vm.closeDialog();
        expect(closeDialog).toHaveBeenCalled();
    });
});
