/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { createContext } from "react";

import {IState} from "../components/structures/RoomView";

const RoomContext = createContext<IState>({
    roomLoading: true,
    peekLoading: false,
    shouldPeek: true,
    membersLoaded: false,
    numUnreadMessages: 0,
    draggingFile: false,
    searching: false,
    guestsCanJoin: false,
    canPeek: false,
    showApps: false,
    isAlone: false,
    isPeeking: false,
    showingPinned: false,
    showReadReceipts: true,
    showRightPanel: true,
    joining: false,
    atEndOfLiveTimeline: true,
    atEndOfLiveTimelineInit: false,
    showTopUnreadMessagesBar: false,
    statusBarVisible: false,
    canReact: false,
    canReply: false,
    useIRCLayout: false,
    matrixClientIsReady: false,
});
RoomContext.displayName = "RoomContext";
export default RoomContext;
