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

export const showThread = (props: {
    rootEvent: MatrixEvent;
    initialEvent?: MatrixEvent;
    highlighted?: boolean;
    push?: boolean;
}) => {
    const push = props.push ?? false;
    const threadViewCard = {
        phase: RightPanelPhases.ThreadView,
        state: {
            threadHeadEvent: props.rootEvent,
            initialEvent: props.initialEvent,
            isInitialEventHighlighted: props.highlighted,
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
};

export const showThreadPanel = () => {
    RightPanelStore.instance.setCard({ phase: RightPanelPhases.ThreadPanel });
};

