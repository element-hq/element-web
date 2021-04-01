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
import ResizeNotifier from "../../../utils/ResizeNotifier";
import ResizeHandle from "../elements/ResizeHandle";
import Resizer from "../../../resizer/resizer";
import PercentageDistributor from "../../../resizer/distributors/percentage";
import {Container, WidgetLayoutStore} from "../../../stores/widgets/WidgetLayoutStore";
import {clamp, percentageOf, percentageWithin} from "../../../utils/numbers";
import {useStateCallback} from "../../../hooks/useStateCallback";
import {replaceableComponent} from "../../../utils/replaceableComponent";

@replaceableComponent("views.rooms.AppsDrawer")
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
            resizingVertical: false, // true when changing the height of the apps drawer
            resizingHorizontal: false, // true when chagning the distribution of the width between widgets
        };

        this._resizeContainer = null;
        this.resizer = this._createResizer();

        this.props.resizeNotifier.on("isResizing", this.onIsResizing);
    }

    componentDidMount() {
        ScalarMessaging.startListening();
        WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(this.props.room), this._updateApps);
        this.dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount() {
        ScalarMessaging.stopListening();
        WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(this.props.room), this._updateApps);
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
        // This one is the vertical, ie. change height of apps drawer
        this.setState({ resizingVertical: resizing });
        if (!resizing) {
            this._relaxResizer();
        }
    };

    _createResizer() {
        // This is the horizontal one, changing the distribution of the width between the app tiles
        // (ie. a vertical resize handle because, the handle itself is vertical...)
        const classNames = {
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse",
        };
        const collapseConfig = {
            onResizeStart: () => {
                this._resizeContainer.classList.add("mx_AppsDrawer_resizing");
                this.setState({ resizingHorizontal: true });
            },
            onResizeStop: () => {
                this._resizeContainer.classList.remove("mx_AppsDrawer_resizing");
                WidgetLayoutStore.instance.setResizerDistributions(
                    this.props.room, Container.Top,
                    this.state.apps.slice(1).map((_, i) => this.resizer.forHandleAt(i).size),
                );
                this.setState({ resizingHorizontal: false });
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
        const distributions = WidgetLayoutStore.instance.getResizerDistributions(this.props.room, Container.Top);
        if (this.state.apps && (this.state.apps.length - 1) === distributions.length) {
            distributions.forEach((size, i) => {
                const distributor = this.resizer.forHandleAt(i);
                if (distributor) {
                    distributor.size = size;
                    distributor.finish();
                }
            });
        } else if (this.state.apps) {
            const distributors = this.resizer.getDistributors();
            distributors.forEach(d => d.item.clearSize());
            distributors.forEach(d => d.start());
            distributors.forEach(d => d.finish());
        }
    };

    isResizing() {
        return this.state.resizingVertical || this.state.resizingHorizontal;
    }

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

    _getApps = () => WidgetLayoutStore.instance.getContainerWidgets(this.props.room, Container.Top);

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
                pointerEvents={this.isResizing() ? 'none' : undefined}
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
                    room={this.props.room}
                    minHeight={100}
                    maxHeight={this.props.maxHeight ? this.props.maxHeight - 50 : undefined}
                    handleClass="mx_AppsContainer_resizerHandle"
                    handleWrapperClass="mx_AppsContainer_resizerHandleContainer"
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
    if (!maxHeight) maxHeight = (window.innerHeight / 4) * 3;

    // Convert from percentage to height. Note that the default height is 280px.
    if (defaultHeight) {
        defaultHeight = clamp(defaultHeight, 0, 100);
        defaultHeight = percentageWithin(defaultHeight / 100, minHeight, maxHeight);
    } else {
        defaultHeight = 280;
    }

    const [height, setHeight] = useStateCallback(defaultHeight, newHeight => {
        newHeight = percentageOf(newHeight, minHeight, maxHeight) * 100;
        WidgetLayoutStore.instance.setContainerHeight(room, Container.Top, newHeight);
    });

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
