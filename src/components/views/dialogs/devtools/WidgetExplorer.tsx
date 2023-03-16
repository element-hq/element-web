/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
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

import React, { useContext, useState } from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { useEventEmitterState } from "../../../../hooks/useEventEmitter";
import { _t } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import WidgetStore, { IApp } from "../../../../stores/WidgetStore";
import { UPDATE_EVENT } from "../../../../stores/AsyncStore";
import FilteredList from "./FilteredList";
import { StateEventEditor } from "./RoomState";

const WidgetExplorer: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");
    const [widget, setWidget] = useState<IApp | null>(null);

    const widgets = useEventEmitterState(WidgetStore.instance, UPDATE_EVENT, () => {
        return WidgetStore.instance.getApps(context.room.roomId);
    });

    if (widget && widgets.includes(widget)) {
        const onBack = (): void => {
            setWidget(null);
        };

        const allState = Array.from(
            Array.from(context.room.currentState.events.values()).map((e: Map<string, MatrixEvent>) => {
                return e.values();
            }),
        ).reduce((p, c) => {
            p.push(...c);
            return p;
        }, [] as MatrixEvent[]);
        const event = allState.find((ev) => ev.getId() === widget.eventId);
        if (!event) {
            // "should never happen"
            return <BaseTool onBack={onBack}>{_t("There was an error finding this widget.")}</BaseTool>;
        }

        return <StateEventEditor mxEvent={event} onBack={onBack} />;
    }

    return (
        <BaseTool onBack={onBack}>
            <FilteredList query={query} onChange={setQuery}>
                {widgets.map((w) => (
                    <button className="mx_DevTools_button" key={w.url + w.eventId} onClick={() => setWidget(w)}>
                        {w.url}
                    </button>
                ))}
            </FilteredList>
        </BaseTool>
    );
};

export default WidgetExplorer;
