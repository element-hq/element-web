/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "../../../../hooks/useEventEmitter";
import { _t } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import WidgetStore, { type IApp } from "../../../../stores/WidgetStore";
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
            return <BaseTool onBack={onBack}>{_t("devtools|failed_to_find_widget")}</BaseTool>;
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
