/*
Copyright 2015, 2016, 2017, 2020 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { lexicographicCompare } from "matrix-js-sdk/src/utils";
import { Room } from "matrix-js-sdk/src/models/room";
import { throttle } from "lodash";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import AppsDrawer from "./AppsDrawer";
import SettingsStore from "../../../settings/SettingsStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { UIFeature } from "../../../settings/UIFeature";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import LegacyCallViewForRoom from "../voip/LegacyCallViewForRoom";
import { objectHasDiff } from "../../../utils/objects";

interface IProps {
    // js-sdk room object
    room: Room;
    userId: string;
    showApps: boolean; // Render apps
    resizeNotifier: ResizeNotifier;
    children?: ReactNode;
}

interface Counter {
    title: string;
    value: number;
    link: string;
    severity: string;
    stateKey: string;
}

interface IState {
    counters: Counter[];
}

export default class AuxPanel extends React.Component<IProps, IState> {
    public static defaultProps = {
        showApps: true,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            counters: this.computeCounters(),
        };
    }

    public componentDidMount(): void {
        const cli = MatrixClientPeg.get();
        if (SettingsStore.getValue("feature_state_counters")) {
            cli.on(RoomStateEvent.Events, this.onRoomStateEvents);
        }
    }

    public componentWillUnmount(): void {
        if (SettingsStore.getValue("feature_state_counters")) {
            MatrixClientPeg.get()?.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        }
    }

    public shouldComponentUpdate(nextProps: IProps, nextState: IState): boolean {
        return objectHasDiff(this.props, nextProps) || objectHasDiff(this.state, nextState);
    }

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getType() === "re.jki.counter") {
            this.updateCounters();
        }
    };

    private updateCounters = throttle(
        () => {
            this.setState({ counters: this.computeCounters() });
        },
        500,
        { leading: true, trailing: true },
    );

    private computeCounters(): Counter[] {
        const counters: Counter[] = [];

        if (this.props.room && SettingsStore.getValue("feature_state_counters")) {
            const stateEvs = this.props.room.currentState.getStateEvents("re.jki.counter");
            stateEvs.sort((a, b) => lexicographicCompare(a.getStateKey()!, b.getStateKey()!));

            for (const ev of stateEvs) {
                const title = ev.getContent().title;
                const value = ev.getContent().value;
                const link = ev.getContent().link;
                const severity = ev.getContent().severity || "normal";
                const stateKey = ev.getStateKey()!;

                // We want a non-empty title but can accept falsy values (e.g.
                // zero)
                if (title && value !== undefined) {
                    counters.push({
                        title,
                        value,
                        link,
                        severity,
                        stateKey,
                    });
                }
            }
        }

        return counters;
    }

    public render(): React.ReactNode {
        const callView = (
            <LegacyCallViewForRoom
                roomId={this.props.room.roomId}
                resizeNotifier={this.props.resizeNotifier}
                showApps={this.props.showApps}
            />
        );

        let appsDrawer;
        if (SettingsStore.getValue(UIFeature.Widgets)) {
            appsDrawer = (
                <AppsDrawer
                    room={this.props.room}
                    userId={this.props.userId}
                    showApps={this.props.showApps}
                    resizeNotifier={this.props.resizeNotifier}
                />
            );
        }

        let stateViews: JSX.Element | null = null;
        if (this.state.counters && SettingsStore.getValue("feature_state_counters")) {
            const counters: JSX.Element[] = [];

            this.state.counters.forEach((counter, idx) => {
                const title = counter.title;
                const value = counter.value;
                const link = counter.link;
                const severity = counter.severity;
                const stateKey = counter.stateKey;

                let span = (
                    <span>
                        {title}: {value}
                    </span>
                );

                if (link) {
                    span = (
                        <a href={link} target="_blank" rel="noreferrer noopener">
                            {span}
                        </a>
                    );
                }

                span = (
                    <span className="mx_AuxPanel_stateViews_span" data-severity={severity} key={"x-" + stateKey}>
                        {span}
                    </span>
                );

                counters.push(span);
                counters.push(
                    <span className="mx_AuxPanel_stateViews_delim" key={"delim" + idx}>
                        {" "}
                        ─{" "}
                    </span>,
                );
            });

            if (counters.length > 0) {
                counters.pop(); // remove last deliminator
                stateViews = <div className="mx_AuxPanel_stateViews">{counters}</div>;
            }
        }

        return (
            <AutoHideScrollbar className="mx_AuxPanel">
                {stateViews}
                {this.props.children}
                {appsDrawer}
                {callView}
            </AutoHideScrollbar>
        );
    }
}
