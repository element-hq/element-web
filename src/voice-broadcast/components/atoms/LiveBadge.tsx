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
import React from "react";

import { Icon as LiveIcon } from "../../../../res/img/compound/live-16px.svg";
import { _t } from "../../../languageHandler";

interface Props {
    grey?: boolean;
}

export const LiveBadge: React.FC<Props> = ({ grey = false }) => {
    const liveBadgeClasses = classNames("mx_LiveBadge", {
        "mx_LiveBadge--grey": grey,
    });

    return (
        <div className={liveBadgeClasses}>
            <LiveIcon className="mx_Icon mx_Icon_16" />
            {_t("Live")}
        </div>
    );
};
