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
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import PollListItem from "./PollListItem";
import { _t } from "../../../../languageHandler";

type PollHistoryListProps = {
    pollStartEvents: MatrixEvent[];
};
export const PollHistoryList: React.FC<PollHistoryListProps> = ({ pollStartEvents }) => {
    return (
        <div className="mx_PollHistoryList">
            {!!pollStartEvents.length ? (
                <ol className="mx_PollHistoryList_list">
                    {pollStartEvents.map((pollStartEvent) => (
                        <PollListItem key={pollStartEvent.getId()!} event={pollStartEvent} />
                    ))}
                </ol>
            ) : (
                <span className="mx_PollHistoryList_noResults">{_t("There are no polls in this room")}</span>
            )}
        </div>
    );
};
