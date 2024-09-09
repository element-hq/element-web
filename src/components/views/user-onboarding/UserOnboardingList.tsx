/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";

import { UserOnboardingTaskWithResolvedCompletion } from "../../../hooks/useUserOnboardingTasks";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import ProgressBar from "../../views/elements/ProgressBar";
import Heading from "../../views/typography/Heading";
import { UserOnboardingTask } from "./UserOnboardingTask";

export const getUserOnboardingCounters = (
    tasks: UserOnboardingTaskWithResolvedCompletion[],
): {
    completed: number;
    waiting: number;
    total: number;
} => {
    const completed = tasks.filter((task) => task.completed === true).length;
    const waiting = tasks.filter((task) => task.completed === false).length;

    return {
        completed: completed,
        waiting: waiting,
        total: completed + waiting,
    };
};

interface Props {
    tasks: UserOnboardingTaskWithResolvedCompletion[];
}

export function UserOnboardingList({ tasks }: Props): JSX.Element {
    const { completed, waiting, total } = getUserOnboardingCounters(tasks);

    return (
        <div className="mx_UserOnboardingList" data-testid="user-onboarding-list">
            <div className="mx_UserOnboardingList_header">
                <Heading size="3" className="mx_UserOnboardingList_title">
                    {waiting > 0
                        ? _t("onboarding|only_n_steps_to_go", {
                              count: waiting,
                          })
                        : _t("onboarding|you_did_it")}
                </Heading>
                <div className="mx_UserOnboardingList_hint">
                    {_t("onboarding|complete_these", {
                        brand: SdkConfig.get("brand"),
                    })}
                </div>
            </div>
            <div className="mx_UserOnboardingList_progress">
                <ProgressBar value={completed} max={total} animated />
            </div>
            <ol className="mx_UserOnboardingList_list">
                {tasks.map((task) => (
                    <UserOnboardingTask key={task.id} completed={task.completed} task={task} />
                ))}
            </ol>
        </div>
    );
}
