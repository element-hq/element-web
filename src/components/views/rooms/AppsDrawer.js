/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

import React from 'react';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AppTile from '../elements/AppTile';
import Modal from '../../../Modal';
import dis from '../../../dispatcher';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import ScalarAuthClient from '../../../ScalarAuthClient';
import ScalarMessaging from '../../../ScalarMessaging';

module.exports = React.createClass({
    displayName: 'AppsDrawer',

    propTypes: {
        room: React.PropTypes.object.isRequired,
    },

    componentWillMount: function() {
        ScalarMessaging.startListening();
        MatrixClientPeg.get().on("RoomState.events", this.onRoomStateEvents);
    },

    componentDidMount: function() {
        this.scalarClient = null;
        const appsDrawer = this;
        if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
            this.scalarClient = new ScalarAuthClient();
            this.scalarClient.connect().done(() => {
                this.forceUpdate();
                if (appsDrawer.state.apps && appsDrawer.state.apps.length < 1) {
                    appsDrawer.onClickAddWidget();
                }
            }, (err) => {
                this.setState({
                    scalar_error: err,
                });
            });
        }
    },

    componentWillUnmount: function() {
        ScalarMessaging.startListening();
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.events", this.onRoomStateEvents);
        }
    },

    _initAppConfig: function(appId, app) {
        console.log("App props: ", this.props);
        app.id = appId;
        app.name = app.type;

        switch(app.type) {
            case 'etherpad':
                app.queryParams = '?userName=' + this.props.userId +
                    '&padId=' + this.props.room.roomId;
                break;
            case 'jitsi': {
                const user = MatrixClientPeg.get().getUser(this.props.userId);
                app.queryParams = '?confId=' + app.data.confId +
                    '&displayName=' + encodeURIComponent(user.displayName) +
                    '&avatarUrl=' + encodeURIComponent(MatrixClientPeg.get().mxcUrlToHttp(user.avatarUrl)) +
                    '&email=' + encodeURIComponent(this.props.userId) +
                    '&isAudioConf=' + app.data.isAudioConf;

                app.name += ' - ' + app.data.confId;
                break;
            }
            case 'vrdemo':
                app.name = 'Matrix VR Demo - ' + app.data.roomAlias;
                app.queryParams = '?roomAlias=' + encodeURIComponent(app.data.roomAlias);
                break;
        }

        return app;
    },

    getInitialState: function() {
        return {
            apps: this._getApps(),
        };
    },

    onRoomStateEvents: function(ev, state) {
        if (ev.getRoomId() !== this.props.room.roomId || ev.getType() !== 'im.vector.modular.widgets') {
            return;
        }
        this._updateApps();
    },

    _getApps: function() {
        const appsStateEvents = this.props.room.currentState.getStateEvents('im.vector.modular.widgets', '');
        if (!appsStateEvents) {
            return [];
        }
        const appsStateEvent = appsStateEvents.getContent();
        if (Object.keys(appsStateEvent).length < 1) {
            return [];
        }

        return Object.keys(appsStateEvent).map((appId) => {
            return this._initAppConfig(appId, appsStateEvent[appId]);
        });
    },

    _updateApps: function() {
        const apps = this._getApps();
        if (apps.length < 1) {
            dis.dispatch({
                action: 'appsDrawer',
                show: false,
            });
        }
        this.setState({
            apps: this._getApps(),
        });
    },

    onClickAddWidget: function(e) {
        // Modal.createDialog(AddAppDialog, {
        //     onFinished: (proceed, type, value) => {
        //         if (!proceed || !type) return;
        //         if (type === 'custom' && !value) return;
        //
        //         const appsStateEvents = this.props.room.currentState.getStateEvents('im.vector.modular.widgets', '');
        //         let appsStateEvent = {};
        //         if (appsStateEvents) {
        //             appsStateEvent = appsStateEvents.getContent();
        //         }
        //
        //         if (appsStateEvent[type]) {
        //             return;
        //         }
        //
        //         switch (type) {
        //             case 'etherpad':
        //                 appsStateEvent.etherpad = {
        //                     type: type,
        //                     url: 'http://localhost:8000/etherpad.html',
        //                 };
        //                 break;
        //             case 'grafana':
        //                 appsStateEvent.grafana = {
        //                     type: type,
        //                     url: 'http://localhost:8000/grafana.html',
        //                 };
        //                 break;
        //             case 'jitsi':
        //                 appsStateEvent.videoConf = {
        //                     type: type,
        //                     url: 'http://localhost:8000/jitsi.html',
        //                     data: {
        //                         confId: this.props.room.roomId.replace(/[^A-Za-z0-9]/g, '_') + Date.now(),
        //                     },
        //                 };
        //                 break;
        //             case 'vrdemo':
        //                 appsStateEvent.vrDemo = {
        //                     type: type,
        //                     url: 'http://localhost:8000/vrdemo.html',
        //                     data: {
        //                         roomAlias: '#vrvc' + this.props.room.roomId.replace(/[^A-Za-z0-9]/g, '_') + Date.now(),
        //                     },
        //                 };
        //                 break;
        //             case 'custom':
        //                 appsStateEvent.custom = {
        //                     type: type,
        //                     url: value,
        //                 };
        //                 break;
        //             default:
        //                 console.warn('Unsupported app type:', type);
        //                 return;
        //         }
        //
        //         MatrixClientPeg.get().sendStateEvent(
        //             this.props.room.roomId,
        //             'im.vector.modular.widgets',
        //             appsStateEvent,
        //             '',
        //         );
        //     },
        // });

        if (e) {
            e.preventDefault();
        }

        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        console.warn("scalarClient: ", this.scalarClient);
        console.warn("hasCredentials: ", this.scalarClient.hasCredentials());
        console.warn("roomId: ", this.props.room.roomId);
        console.warn("Scalar interface: ", this.scalarClient.getScalarInterfaceUrlForRoom(this.props.room.roomId));
        const src = (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                this.scalarClient.getScalarInterfaceUrlForRoom(this.props.room.roomId) :
                null;
        console.warn("src: ", src);
        Modal.createDialog(IntegrationsManager, {
            src: src,
            onFinished: ()=>{
                if (e) {
                    this.props.onCancelClick(e);
                }
            },
        }, "mx_IntegrationsManager");
    },

    render: function() {
        const apps = this.state.apps.map(
            (app, index, arr) => {
                let appUrl = app.url;
                if (app.queryParams) {
                    appUrl += app.queryParams;
                }
                return <AppTile
                    key={app.name}
                    id={app.id}
                    url={appUrl}
                    name={app.name}
                    fullWidth={arr.length<2 ? true : false}
                    room={this.props.room}
                    userId={this.props.userId}
                />;
            });

        const addWidget = this.state.apps && this.state.apps.length < 2 &&
            (<div onClick={this.onClickAddWidget}
                            role="button"
                            tabIndex="0"
                            className="mx_AddWidget_button"
                            title="Add a widget">
                            [+] Add a widget
                        </div>);

        return (
            <div className="mx_AppsDrawer">
                <div id="apps" className="mx_AppsContainer">
                    {apps}
                </div>
                {addWidget}
            </div>
        );
    },
});
