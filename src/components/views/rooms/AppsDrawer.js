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

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Resizable} from "re-resizable";

import AppTile from '../elements/AppTile';
import dis from '../../../dispatcher/dispatcher';
import * as sdk from '../../../index';
import * as ScalarMessaging from '../../../ScalarMessaging';
import WidgetUtils from '../../../utils/WidgetUtils';
import WidgetEchoStore from "../../../stores/WidgetEchoStore";
import {IntegrationManagers} from "../../../integrations/IntegrationManagers";
import SettingsStore from "../../../settings/SettingsStore";
import {useLocalStorageState} from "../../../hooks/useLocalStorageState";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import WidgetStore from "../../../stores/WidgetStore";
import ResizeHandle from "../elements/ResizeHandle";
import Resizer from "../../../resizer/resizer";
import PercentageDistributor from "../../../resizer/distributors/percentage";

export default class AppsDrawer extends React.Component {
    static propTypes = {
        userId: PropTypes.string.isRequired,
        room: PropTypes.object.isRequired,
        resizeNotifier: PropTypes.instanceOf(ResizeNotifier).isRequired,
        showApps: PropTypes.bool, // Should apps be rendered
    };

    static defaultProps = {
        showApps: true,
    };

    constructor(props) {
        super(props);

        this.state = {
            apps: this._getApps(),
        };

        this._resizeContainer = null;
        this.resizer = this._createResizer();

        this.props.resizeNotifier.on("isResizing", this.onIsResizing);
    }

    componentDidMount() {
        ScalarMessaging.startListening();
        WidgetStore.instance.on(this.props.room.roomId, this._updateApps);
        this.dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount() {
        ScalarMessaging.stopListening();
        WidgetStore.instance.off(this.props.room.roomId, this._updateApps);
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
        if (this._resizeContainer) {
            this.resizer.detach();
        }
        this.props.resizeNotifier.off("isResizing", this.onIsResizing);
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line camelcase
    UNSAFE_componentWillReceiveProps(newProps) {
        // Room has changed probably, update apps
        this._updateApps();
    }

    onIsResizing = (resizing) => {
        this.setState({ resizing });
        if (!resizing) {
            this._relaxResizer();
        }
    };

    _createResizer() {
        const classNames = {
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse",
        };
        const collapseConfig = {
            onResizeStart: () => {
                this._resizeContainer.classList.add("mx_AppsDrawer_resizing");
            },
            onResizeStop: () => {
                this._resizeContainer.classList.remove("mx_AppsDrawer_resizing");
                // persist to localStorage
                localStorage.setItem(this._getStorageKey(), JSON.stringify([
                    this.state.apps.map(app => app.id),
                    ...this.state.apps.slice(1).map((_, i) => this.resizer.forHandleAt(i).size),
                ]));
            },
        };
        // pass a truthy container for now, we won't call attach until we update it
        const resizer = new Resizer({}, PercentageDistributor, collapseConfig);
        resizer.setClassNames(classNames);
        return resizer;
    }

    _collectResizer = (ref) => {
        if (this._resizeContainer) {
            this.resizer.detach();
        }

        if (ref) {
            this.resizer.container = ref;
            this.resizer.attach();
        }
        this._resizeContainer = ref;
        this._loadResizerPreferences();
    };

    _getStorageKey = () => `mx_apps_drawer-${this.props.room.roomId}`;

    _getAppsHash = (apps) => apps.map(app => app.id).join("~");

    componentDidUpdate(prevProps, prevState) {
        if (this._getAppsHash(this.state.apps) !== this._getAppsHash(prevState.apps)) {
            this._loadResizerPreferences();
        }
    }

    _relaxResizer = () => {
        const distributors = this.resizer.getDistributors();

        // relax all items if they had any overconstrained flexboxes
        distributors.forEach(d => d.start());
        distributors.forEach(d => d.finish());
    };

    _loadResizerPreferences = () => {
        try {
            const [[...lastIds], ...sizes] = JSON.parse(localStorage.getItem(this._getStorageKey()));
            // Every app was included in the last split, reuse the last sizes
            if (this.state.apps.length <= lastIds.length && this.state.apps.every((app, i) => lastIds[i] === app.id)) {
                sizes.forEach((size, i) => {
                    const distributor = this.resizer.forHandleAt(i);
                    if (distributor) {
                        distributor.size = size;
                        distributor.finish();
                    }
                });
                return;
            }
        } catch (e) {
            // this is expected
        }

        if (this.state.apps) {
            const distributors = this.resizer.getDistributors();
            distributors.forEach(d => d.item.clearSize());
            distributors.forEach(d => d.start());
            distributors.forEach(d => d.finish());
        }
    };

    onAction = (action) => {
        const hideWidgetKey = this.props.room.roomId + '_hide_widget_drawer';
        switch (action.action) {
            case 'appsDrawer':
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

    _getApps = () => WidgetStore.instance.getPinnedApps(this.props.room.roomId);

    _updateApps = () => {
        this.setState({
            apps: this._getApps(),
        });
    };

    _launchManageIntegrations() {
        if (SettingsStore.getValue("feature_many_integration_managers")) {
            IntegrationManagers.sharedInstance().openAll();
        } else {
            IntegrationManagers.sharedInstance().getPrimaryManager().open(this.props.room, 'add_integ');
        }
    }

    render() {
        if (!this.props.showApps) return <div />;

        const apps = this.state.apps.map((app, index, arr) => {
            return (<AppTile
                key={app.id}
                app={app}
                fullWidth={arr.length < 2}
                room={this.props.room}
                userId={this.props.userId}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                waitForIframeLoad={app.waitForIframeLoad}
            />);
        });

        if (apps.length === 0) {
            return <div />;
        }

        let spinner;
        if (
            apps.length === 0 && WidgetEchoStore.roomHasPendingWidgets(
                this.props.room.roomId,
                WidgetUtils.getRoomWidgets(this.props.room),
            )
        ) {
            const Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader />;
        }

        const classes = classNames({
            mx_AppsDrawer: true,
            mx_AppsDrawer_fullWidth: apps.length < 2,
            mx_AppsDrawer_resizing: this.state.resizing,
            mx_AppsDrawer_2apps: apps.length === 2,
            mx_AppsDrawer_3apps: apps.length === 3,
        });

        return (
            <div className={classes}>
                <PersistentVResizer
                    id={"apps-drawer_" + this.props.room.roomId}
                    minHeight={100}
                    maxHeight={this.props.maxHeight ? this.props.maxHeight - 50 : undefined}
                    handleClass="mx_AppsContainer_resizerHandle"
                    className="mx_AppsContainer_resizer"
                    resizeNotifier={this.props.resizeNotifier}
                >
                    <div className="mx_AppsContainer" ref={this._collectResizer}>
                        { apps.map((app, i) => {
                            if (i < 1) return app;
                            return <React.Fragment key={app.key}>
                                <ResizeHandle reverse={i > apps.length / 2} />
                                { app }
                            </React.Fragment>;
                        }) }
                    </div>
                </PersistentVResizer>
                { spinner }
            </div>
        );
    }
}

const PersistentVResizer = ({
    id,
    minHeight,
    maxHeight,
    className,
    handleWrapperClass,
    handleClass,
    resizeNotifier,
    children,
}) => {
    const [height, setHeight] = useLocalStorageState("pvr_" + id, 280); // old fixed height was 273px

    return <Resizable
        size={{height: Math.min(height, maxHeight)}}
        minHeight={minHeight}
        maxHeight={maxHeight}
        onResizeStart={() => {
            resizeNotifier.startResizing();
        }}
        onResize={() => {
            resizeNotifier.notifyTimelineHeightChanged();
        }}
        onResizeStop={(e, dir, ref, d) => {
            setHeight(height + d.height);
            resizeNotifier.stopResizing();
        }}
        handleWrapperClass={handleWrapperClass}
        handleClasses={{bottom: handleClass}}
        className={className}
        enable={{bottom: true}}
    >
        { children }
    </Resizable>;
};
