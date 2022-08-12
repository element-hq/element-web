/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useMemo } from "react";

import { AppDownloadDialog } from "../components/views/dialogs/AppDownloadDialog";
import { UserTab } from "../components/views/dialogs/UserTab";
import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import { Action } from "../dispatcher/actions";
import defaultDispatcher from "../dispatcher/dispatcher";
import { _t } from "../languageHandler";
import Modal from "../Modal";
import { Notifier } from "../Notifier";
import PosthogTrackers from "../PosthogTrackers";
import { UseCase } from "../settings/enums/UseCase";
import { useSettingValue } from "./useSettings";
import { UserOnboardingContext } from "./useUserOnboardingContext";

export interface UserOnboardingTask {
    id: string;
    title: string;
    description: string;
    relevant?: UseCase[];
    action?: {
        label: string;
        onClick?: (ev?: ButtonEvent) => void;
        href?: string;
        hideOnComplete?: boolean;
    };
}

interface InternalUserOnboardingTask extends UserOnboardingTask {
    completed: (ctx: UserOnboardingContext) => boolean;
}

const hasOpenDMs = (ctx: UserOnboardingContext) => Boolean(Object.entries(ctx.dmRooms).length);

const onClickStartDm = (ev: ButtonEvent) => {
    PosthogTrackers.trackInteraction("WebUserOnboardingTaskSendDm", ev);
    defaultDispatcher.dispatch({ action: 'view_create_chat' });
};

const tasks: InternalUserOnboardingTask[] = [
    {
        id: "create-account",
        title: _t("Create account"),
        description: _t("You made it!"),
        completed: () => true,
    },
    {
        id: "find-friends",
        title: _t("Find and invite your friends"),
        description: _t("It’s what you’re here for, so lets get to it"),
        completed: hasOpenDMs,
        relevant: [UseCase.PersonalMessaging, UseCase.Skip],
        action: {
            label: _t("Find friends"),
            onClick: onClickStartDm,
        },
    },
    {
        id: "find-coworkers",
        title: _t("Find and invite your co-workers"),
        description: _t("Get stuff done by finding your teammates"),
        completed: hasOpenDMs,
        relevant: [UseCase.WorkMessaging],
        action: {
            label: _t("Find people"),
            onClick: onClickStartDm,
        },
    },
    {
        id: "find-community-members",
        title: _t("Find and invite your community members"),
        description: _t("Get stuff done by finding your teammates"),
        completed: hasOpenDMs,
        relevant: [UseCase.CommunityMessaging],
        action: {
            label: _t("Find people"),
            onClick: onClickStartDm,
        },
    },
    {
        id: "download-apps",
        title: _t("Download Element"),
        description: _t("Don’t miss a thing by taking Element with you"),
        completed: (ctx: UserOnboardingContext) => {
            return Boolean(ctx.devices.filter(it => it.device_id !== ctx.myDevice).length);
        },
        action: {
            label: _t("Download apps"),
            onClick: (ev: ButtonEvent) => {
                PosthogTrackers.trackInteraction("WebUserOnboardingTaskDownloadApps", ev);
                Modal.createDialog(AppDownloadDialog, {}, "mx_AppDownloadDialog_wrapper", false, true);
            },
        },
    },
    {
        id: "setup-profile",
        title: _t("Set up your profile"),
        description: _t("Make sure people know it’s really you"),
        completed: (info: UserOnboardingContext) => Boolean(info.avatar),
        action: {
            label: _t("Your profile"),
            onClick: (ev: ButtonEvent) => {
                PosthogTrackers.trackInteraction("WebUserOnboardingTaskSetupProfile", ev);
                defaultDispatcher.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.General,
                });
            },
        },
    },
    {
        id: "permission-notifications",
        title: _t("Turn on notifications"),
        description: _t("Don’t miss a reply or important message"),
        completed: () => Notifier.isPossible(),
        action: {
            label: _t("Enable notifications"),
            onClick: (ev: ButtonEvent) => {
                PosthogTrackers.trackInteraction("WebUserOnboardingTaskEnableNotifications", ev);
                Notifier.setEnabled(true);
            },
            hideOnComplete: true,
        },
    },
];

export function useUserOnboardingTasks(context: UserOnboardingContext): [UserOnboardingTask[], UserOnboardingTask[]] {
    const useCase = useSettingValue<UseCase | null>("FTUE.useCaseSelection") ?? UseCase.Skip;
    const relevantTasks = useMemo(
        () => tasks.filter(it => !it.relevant || it.relevant.includes(useCase)),
        [useCase],
    );
    const completedTasks = relevantTasks.filter(it => context && it.completed(context));
    return [completedTasks, relevantTasks.filter(it => !completedTasks.includes(it))];
}
