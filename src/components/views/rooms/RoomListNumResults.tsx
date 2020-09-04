/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, {useState} from "react";

import { _t } from "../../../languageHandler";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import {useEventEmitter} from "../../../hooks/useEventEmitter";

const RoomListNumResults: React.FC = () => {
    const [count, setCount] = useState<number>(null);
    useEventEmitter(RoomListStore.instance, LISTS_UPDATE_EVENT, () => {
        if (RoomListStore.instance.getFirstNameFilterCondition()) {
            const numRooms = Object.values(RoomListStore.instance.orderedLists).flat(1).length;
            setCount(numRooms);
        } else {
            setCount(null);
        }
    });

    if (typeof count !== "number") return null;

    return <div className="mx_LeftPanel_roomListFilterCount">
        {_t("%(count)s results", { count })}
    </div>;
};

export default RoomListNumResults;
