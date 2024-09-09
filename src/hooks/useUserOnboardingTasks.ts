/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useMemo } from "react";

import { AppDownloadDialog, showAppDownloadDialogPrompt } from "../components/views/dialogs/AppDownloadDialog";
import { UserTab } from "../components/views/dialogs/UserTab";
import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import { Action } from "../dispatcher/actions";
import defaultDispatcher from "../dispatcher/dispatcher";
import { _t } from "../languageHandler";
import Modal from "../Modal";
import { Notifier } from "../Notifier";
import PosthogTrackers from "../PosthogTrackers";
import SdkConfig from "../SdkConfig";
import { UseCase } from "../settings/enums/UseCase";
import { useSettingValue } from "./useSettings";
import { UserOnboardingContext } from "./useUserOnboardingContext";

interface UserOnboardingTask {
    id: string;
    title: string | (() => string);
    description: string | (() => string);
    relevant?: UseCase[];
    action?: {
        label: string;
        onClick?: (ev: ButtonEvent) => void;
        href?: string;
        hideOnComplete?: boolean;
    };
    completed: (ctx: UserOnboardingContext) => boolean;
    disabled?(): boolean;
}

export interface UserOnboardingTaskWithResolvedCompletion extends Omit<UserOnboardingTask, "completed"> {
    completed: boolean;
}

const onClickStartDm = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebUserOnboardingTaskSendDm", ev);
    defaultDispatcher.dispatch({ action: "view_create_chat" });
};

const tasks: UserOnboardingTask[] = [
    {
        id: "create-account",
        title: _t("auth|create_account_title"),
        description: _t("onboarding|you_made_it"),
        completed: () => true,
    },
    {
        id: "find-friends",
        title: _t("onboarding|find_friends"),
        description: _t("onboarding|find_friends_description"),
        completed: (ctx: UserOnboardingContext) => ctx.hasDmRooms,
        relevant: [UseCase.PersonalMessaging, UseCase.Skip],
        action: {
            label: _t("onboarding|find_friends_action"),
            onClick: onClickStartDm,
        },
    },
    {
        id: "find-coworkers",
        title: _t("onboarding|find_coworkers"),
        description: _t("onboarding|get_stuff_done"),
        completed: (ctx: UserOnboardingContext) => ctx.hasDmRooms,
        relevant: [UseCase.WorkMessaging],
        action: {
            label: _t("onboarding|find_people"),
            onClick: onClickStartDm,
        },
    },
    {
        id: "find-community-members",
        title: _t("onboarding|find_community_members"),
        description: _t("onboarding|get_stuff_done"),
        completed: (ctx: UserOnboardingContext) => ctx.hasDmRooms,
        relevant: [UseCase.CommunityMessaging],
        action: {
            label: _t("onboarding|find_people"),
            onClick: onClickStartDm,
        },
    },
    {
        id: "download-apps",
        title: () =>
            _t("onboarding|download_app", {
                brand: SdkConfig.get("brand"),
            }),
        description: () =>
            _t("onboarding|download_app_description", {
                brand: SdkConfig.get("brand"),
            }),
        completed: (ctx: UserOnboardingContext) => ctx.hasDevices,
        action: {
            label: _t("onboarding|download_app_action"),
            onClick: (ev: ButtonEvent) => {
                PosthogTrackers.trackInteraction("WebUserOnboardingTaskDownloadApps", ev);
                Modal.createDialog(AppDownloadDialog, {}, "mx_AppDownloadDialog_wrapper", false, true);
            },
        },
        disabled(): boolean {
            return !showAppDownloadDialogPrompt();
        },
    },
    {
        id: "setup-profile",
        title: _t("onboarding|set_up_profile"),
        description: _t("onboarding|set_up_profile_description"),
        completed: (ctx: UserOnboardingContext) => ctx.hasAvatar,
        action: {
            label: _t("onboarding|set_up_profile_action"),
            onClick: (ev: ButtonEvent) => {
                PosthogTrackers.trackInteraction("WebUserOnboardingTaskSetupProfile", ev);
                defaultDispatcher.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Account,
                });
            },
        },
    },
    {
        id: "permission-notifications",
        title: _t("onboarding|enable_notifications"),
        description: _t("onboarding|enable_notifications_description"),
        completed: (ctx: UserOnboardingContext) => !ctx.showNotificationsPrompt,
        action: {
            label: _t("onboarding|enable_notifications_action"),
            onClick: (ev: ButtonEvent) => {
                PosthogTrackers.trackInteraction("WebUserOnboardingTaskEnableNotifications", ev);
                defaultDispatcher.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Notifications,
                });
                Notifier.setPromptHidden(true);
            },
            hideOnComplete: !Notifier.isPossible(),
        },
    },
];

export function useUserOnboardingTasks(context: UserOnboardingContext): UserOnboardingTaskWithResolvedCompletion[] {
    const useCase = useSettingValue<UseCase | null>("FTUE.useCaseSelection") ?? UseCase.Skip;

    return useMemo<UserOnboardingTaskWithResolvedCompletion[]>(() => {
        return tasks
            .filter((task) => {
                if (task.disabled?.()) return false;
                return !task.relevant || task.relevant.includes(useCase);
            })
            .map((task) => ({
                ...task,
                completed: task.completed(context),
            }));
    }, [context, useCase]);
}
