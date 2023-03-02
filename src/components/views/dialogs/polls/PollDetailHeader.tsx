/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { Icon as LeftCaretIcon } from "../../../../../res/img/element-icons/caret-left.svg";
import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import { PollHistoryFilter } from "./types";

interface Props {
    filter: PollHistoryFilter;
    onNavigateBack: () => void;
}

export const PollDetailHeader: React.FC<Props> = ({ filter, onNavigateBack }) => {
    return (
        <AccessibleButton kind="content_inline" onClick={onNavigateBack} className="mx_PollDetailHeader">
            <LeftCaretIcon className="mx_PollDetailHeader_icon" />
            {filter === "ACTIVE" ? _t("Active polls") : _t("Past polls")}
        </AccessibleButton>
    );
};
