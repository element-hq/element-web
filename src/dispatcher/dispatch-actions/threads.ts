/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import dis from "../dispatcher";
import { Action } from "../actions";
import { TimelineRenderingType } from "../../contexts/RoomContext";

export const showThread = (props: {
    rootEvent: MatrixEvent;
    initialEvent?: MatrixEvent;
    highlighted?: boolean;
    scroll_into_view?: boolean;
    push?: boolean;
}) => {
    const push = props.push ?? false;
    const threadViewCard = {
        phase: RightPanelPhases.ThreadView,
        state: {
            threadHeadEvent: props.rootEvent,
            initialEvent: props.initialEvent,
            isInitialEventHighlighted: props.highlighted,
            initialEventScrollIntoView: props.scroll_into_view,
        },
    };
    if (push) {
        RightPanelStore.instance.pushCard(threadViewCard);
    } else {
        RightPanelStore.instance.setCards([
            { phase: RightPanelPhases.ThreadPanel },
            threadViewCard,
        ]);
    }

    // Focus the composer
    dis.dispatch({
        action: Action.FocusSendMessageComposer,
        context: TimelineRenderingType.Thread,
    });
};

export const showThreadPanel = () => {
    RightPanelStore.instance.setCard({ phase: RightPanelPhases.ThreadPanel });
};

