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

import classNames from "classnames";
import * as React from "react";

import { UserOnboardingTaskWithResolvedCompletion } from "../../../hooks/useUserOnboardingTasks";
import AccessibleButton from "../../views/elements/AccessibleButton";
import Heading from "../../views/typography/Heading";

interface Props {
    task: UserOnboardingTaskWithResolvedCompletion;
    completed?: boolean;
}

export function UserOnboardingTask({ task, completed = false }: Props): JSX.Element {
    const title = typeof task.title === "function" ? task.title() : task.title;
    const description = typeof task.description === "function" ? task.description() : task.description;

    return (
        <li
            data-testid="user-onboarding-task"
            className={classNames("mx_UserOnboardingTask", {
                mx_UserOnboardingTask_completed: completed,
            })}
        >
            <div
                className="mx_UserOnboardingTask_number"
                role="checkbox"
                aria-disabled="true"
                aria-checked={completed}
                aria-labelledby={`mx_UserOnboardingTask_${task.id}`}
            />
            <div id={`mx_UserOnboardingTask_${task.id}`} className="mx_UserOnboardingTask_content">
                <Heading size="h4" className="mx_UserOnboardingTask_title">
                    {title}
                </Heading>
                <div className="mx_UserOnboardingTask_description">{description}</div>
            </div>
            {task.action && (!task.action.hideOnComplete || !completed) && (
                <AccessibleButton
                    element="a"
                    className="mx_UserOnboardingTask_action"
                    kind="primary_outline"
                    href={task.action.href}
                    target="_blank"
                    onClick={task.action.onClick ?? null}
                >
                    {task.action.label}
                </AccessibleButton>
            )}
        </li>
    );
}
