/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
                <Heading size="4" className="mx_UserOnboardingTask_title">
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
