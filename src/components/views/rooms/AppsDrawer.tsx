/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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
import classNames from "classnames";
import { Resizable, Size } from "re-resizable";
import { Room } from "matrix-js-sdk/src/models/room";
import { IWidget } from "matrix-widget-api";

import AppTile from "../elements/AppTile";
import dis from "../../../dispatcher/dispatcher";
import * as ScalarMessaging from "../../../ScalarMessaging";
import WidgetUtils from "../../../utils/WidgetUtils";
import WidgetEchoStore from "../../../stores/WidgetEchoStore";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import ResizeHandle from "../elements/ResizeHandle";
import Resizer from "../../../resizer/resizer";
import PercentageDistributor from "../../../resizer/distributors/percentage";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { clamp, percentageOf, percentageWithin } from "../../../utils/numbers";
import UIStore from "../../../stores/UIStore";
import { ActionPayload } from "../../../dispatcher/payloads";
import Spinner from "../elements/Spinner";

interface IProps {
    userId: string;
    room: Room;
    resizeNotifier: ResizeNotifier;
    showApps?: boolean; // Should apps be rendered
    maxHeight: number;
}

interface IState {
    apps: {
        [Container.Top]: IWidget[];
        [Container.Center]: IWidget[];
        [Container.Right]?: IWidget[];
    };
    resizingVertical: boolean; // true when changing the height of the apps drawer
    resizingHorizontal: boolean; // true when changing the distribution of the width between widgets
    resizing: boolean;
}

export default class AppsDrawer extends React.Component<IProps, IState> {
    private unmounted = false;
    private resizeContainer?: HTMLDivElement;
    private resizer: Resizer;
    private dispatcherRef?: string;
    public static defaultProps: Partial<IProps> = {
        showApps: true,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            apps: this.getApps(),
            resizingVertical: false,
            resizingHorizontal: false,
            resizing: false,
        };

        this.resizer = this.createResizer();

        this.props.resizeNotifier.on("isResizing", this.onIsResizing);
    }

    public componentDidMount(): void {
        ScalarMessaging.startListening();
        WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(this.props.room), this.updateApps);
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        ScalarMessaging.stopListening();
        WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(this.props.room), this.updateApps);
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
        if (this.resizeContainer) {
            this.resizer.detach();
        }
        this.props.resizeNotifier.off("isResizing", this.onIsResizing);
    }

    private onIsResizing = (resizing: boolean): void => {
        // This one is the vertical, ie. change height of apps drawer
        this.setState({ resizingVertical: resizing });
        if (!resizing) {
            this.relaxResizer();
        }
    };

    private createResizer(): Resizer {
        // This is the horizontal one, changing the distribution of the width between the app tiles
        // (ie. a vertical resize handle because, the handle itself is vertical...)
        const classNames = {
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle--vertical",
            reverse: "mx_ResizeHandle_reverse",
        };
        const collapseConfig = {
            onResizeStart: () => {
                this.resizeContainer?.classList.add("mx_AppsDrawer--resizing");
                this.setState({ resizingHorizontal: true });
            },
            onResizeStop: () => {
                this.resizeContainer?.classList.remove("mx_AppsDrawer--resizing");
                WidgetLayoutStore.instance.setResizerDistributions(
                    this.props.room,
                    Container.Top,
                    this.topApps()
                        .slice(1)
                        .map((_, i) => this.resizer.forHandleAt(i)!.size),
                );
                this.setState({ resizingHorizontal: false });
            },
        };
        // pass a truthy container for now, we won't call attach until we update it
        const resizer = new Resizer(null, PercentageDistributor, collapseConfig);
        resizer.setClassNames(classNames);
        return resizer;
    }

    private collectResizer = (ref: HTMLDivElement): void => {
        if (this.resizeContainer) {
            this.resizer.detach();
        }

        if (ref) {
            this.resizer.container = ref;
            this.resizer.attach();
        }
        this.resizeContainer = ref;
        this.loadResizerPreferences();
    };

    private getAppsHash = (apps: IWidget[]): string => apps.map((app) => app.id).join("~");

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (prevProps.userId !== this.props.userId || prevProps.room !== this.props.room) {
            // Room has changed, update apps
            this.updateApps();
        } else if (this.getAppsHash(this.topApps()) !== this.getAppsHash(prevState.apps[Container.Top])) {
            this.loadResizerPreferences();
        }
    }

    private relaxResizer = (): void => {
        const distributors = this.resizer.getDistributors();

        // relax all items if they had any overconstrained flexboxes
        distributors.forEach((d) => d.start());
        distributors.forEach((d) => d.finish());
    };

    private loadResizerPreferences = (): void => {
        const distributions = WidgetLayoutStore.instance.getResizerDistributions(this.props.room, Container.Top);
        if (this.state.apps && this.topApps().length - 1 === distributions.length) {
            distributions.forEach((size, i) => {
                const distributor = this.resizer.forHandleAt(i);
                if (distributor) {
                    distributor.size = size;
                    distributor.finish();
                }
            });
        } else if (this.state.apps) {
            const distributors = this.resizer.getDistributors();
            distributors.forEach((d) => d.item.clearSize());
            distributors.forEach((d) => d.start());
            distributors.forEach((d) => d.finish());
        }
    };

    private isResizing(): boolean {
        return this.state.resizingVertical || this.state.resizingHorizontal;
    }

    private onAction = (action: ActionPayload): void => {
        const hideWidgetKey = this.props.room.roomId + "_hide_widget_drawer";
        switch (action.action) {
            case "appsDrawer":
                // Note: these booleans are awkward because localstorage is fundamentally
                // string-based. We also do exact equality on the strings later on.
                if (action.show) {
                    localStorage.setItem(hideWidgetKey, "false");
                } else {
                    // Store hidden state of widget
                    // Don't show if previously hidden
                    localStorage.setItem(hideWidgetKey, "true");
                }

                break;
        }
    };

    private getApps = (): IState["apps"] => ({
        [Container.Top]: WidgetLayoutStore.instance.getContainerWidgets(this.props.room, Container.Top),
        [Container.Center]: WidgetLayoutStore.instance.getContainerWidgets(this.props.room, Container.Center),
    });
    private topApps = (): IWidget[] => this.state.apps[Container.Top];
    private centerApps = (): IWidget[] => this.state.apps[Container.Center];

    private updateApps = (): void => {
        if (this.unmounted) return;
        this.setState({
            apps: this.getApps(),
        });
    };

    public render(): React.ReactNode {
        if (!this.props.showApps) return <div />;
        const widgetIsMaxmised: boolean = this.centerApps().length > 0;
        const appsToDisplay = widgetIsMaxmised ? this.centerApps() : this.topApps();
        const apps = appsToDisplay.map((app, index, arr) => {
            return (
                <AppTile
                    key={app.id}
                    app={app}
                    fullWidth={arr.length < 2}
                    room={this.props.room}
                    userId={this.props.userId}
                    creatorUserId={app.creatorUserId}
                    widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                    waitForIframeLoad={app.waitForIframeLoad}
                    pointerEvents={this.isResizing() ? "none" : undefined}
                />
            );
        });

        if (apps.length === 0) {
            return <div />;
        }

        let spinner;
        if (
            apps.length === 0 &&
            WidgetEchoStore.roomHasPendingWidgets(this.props.room.roomId, WidgetUtils.getRoomWidgets(this.props.room))
        ) {
            spinner = <Spinner />;
        }

        const classes = classNames({
            "mx_AppsDrawer": true,
            "mx_AppsDrawer--maximised": widgetIsMaxmised,
            "mx_AppsDrawer--resizing": this.state.resizing,
            "mx_AppsDrawer--2apps": apps.length === 2,
            "mx_AppsDrawer--3apps": apps.length === 3,
        });
        const appContainers = (
            <div className="mx_AppsContainer" ref={this.collectResizer}>
                {apps.map((app, i) => {
                    if (i < 1) return app;
                    return (
                        <React.Fragment key={app.key}>
                            <ResizeHandle reverse={i > apps.length / 2} />
                            {app}
                        </React.Fragment>
                    );
                })}
            </div>
        );

        let drawer;
        if (widgetIsMaxmised) {
            drawer = appContainers;
        } else {
            drawer = (
                <PersistentVResizer
                    room={this.props.room}
                    minHeight={100}
                    maxHeight={this.props.maxHeight - 50}
                    handleClass="mx_AppsContainer_resizerHandle"
                    handleWrapperClass="mx_AppsContainer_resizerHandleContainer"
                    className="mx_AppsContainer_resizer"
                    resizeNotifier={this.props.resizeNotifier}
                >
                    {appContainers}
                </PersistentVResizer>
            );
        }

        return (
            <div className={classes}>
                {drawer}
                {spinner}
            </div>
        );
    }
}

interface IPersistentResizerProps {
    room: Room;
    minHeight: number;
    maxHeight: number;
    className: string;
    handleWrapperClass: string;
    handleClass: string;
    resizeNotifier: ResizeNotifier;
    children: React.ReactNode;
}

const PersistentVResizer: React.FC<IPersistentResizerProps> = ({
    room,
    minHeight,
    maxHeight,
    className,
    handleWrapperClass,
    handleClass,
    resizeNotifier,
    children,
}) => {
    let defaultHeight = WidgetLayoutStore.instance.getContainerHeight(room, Container.Top);

    // Arbitrary defaults to avoid NaN problems. 100 px or 3/4 of the visible window.
    if (!minHeight) minHeight = 100;
    if (!maxHeight) maxHeight = (UIStore.instance.windowHeight / 4) * 3;

    // Convert from percentage to height. Note that the default height is 280px.
    if (defaultHeight) {
        defaultHeight = clamp(defaultHeight, 0, 100);
        defaultHeight = percentageWithin(defaultHeight / 100, minHeight, maxHeight);
    } else {
        defaultHeight = 280;
    }

    return (
        <Resizable
            // types do not support undefined height/width
            // but resizable code checks specifically for undefined on Size prop
            size={{ height: Math.min(defaultHeight, maxHeight), width: undefined } as unknown as Size}
            minHeight={minHeight}
            maxHeight={maxHeight}
            onResizeStart={() => {
                resizeNotifier.startResizing();
            }}
            onResize={() => {
                resizeNotifier.notifyTimelineHeightChanged();
            }}
            onResizeStop={(e, dir, ref, d) => {
                let newHeight = defaultHeight! + d.height;
                newHeight = percentageOf(newHeight, minHeight, maxHeight) * 100;

                WidgetLayoutStore.instance.setContainerHeight(room, Container.Top, newHeight);

                resizeNotifier.stopResizing();
            }}
            handleWrapperClass={handleWrapperClass}
            handleClasses={{ bottom: handleClass }}
            className={className}
            enable={{ bottom: true }}
        >
            {children}
        </Resizable>
    );
};
