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
                <Heading size="h3" className="mx_UserOnboardingList_title">
                    {waiting > 0
                        ? _t("Only %(count)s steps to go", {
                              count: waiting,
                          })
                        : _t("You did it!")}
                </Heading>
                <div className="mx_UserOnboardingList_hint">
                    {_t("Complete these to get the most out of %(brand)s", {
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
