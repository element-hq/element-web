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

const React = require('react');
const AddAppDialog = require('../dialogs/AddAppDialog');
const AppTile = require('../elements/AppTile');
const Modal = require("../../../Modal");

// FIXME -- Hard coded widget config
const roomWidgetConfig = {
    // Cooking room
    '!IAkkwswSrOSzPRWksX:matrix.org': [
        {
            id: "youtube",
            url: "https://www.youtube.com/embed/ZJy1ajvMU1k?controls=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1&autoplay=1",
            name: "Live stream - Boeuf Bourguignon",
        },
        {
            id: "recipie",
            url: "http://localhost:8000/recepie.html",
            name: "Ingredients - Boeuf Bourguignon",
        },
    ],
    // Grafana room
    '!JWeMRscvtWqfNuzmSf:matrix.org': [
        {
            id: "grafana",
            url: "http://localhost:8000/grafana.html",
            name: "Monitoring our Single-Point-Of-Failure DB",
        },
    ],
    // Camgirl room - https://www.youtube.com/watch?v=ZfkwW4GgAiU
    '!wQqrqwOipOOWALxJNe:matrix.org': [
        {
            id: "youtube",
            url: "https://www.youtube.com/embed/ZfkwW4GgAiU?controls=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1&autoplay=1",
            name: "Live stream - ChatGirl86",
        },
        {
            id: "thermometer",
            url: "http://localhost:8000/index.html",
            name: "Tip Me!!! -- Send me cash $$$",
        },
    ],
    // Game room - https://www.youtube.com/watch?v=Dm2Ma1dOFO4
    '!dYSCwtVljhTdBlgNxq:matrix.org': [
        {
            id: "youtube",
            url: "https://www.youtube.com/embed/Dm2Ma1dOFO4?controls=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1&autoplay=1",
            name: "Live stream - Overwatch Balle Royale",
        },
        {
            id: "thermometer",
            url: "http://localhost:8000/index.html",
            name: "Tip Me!!! -- Send me cash $$$",
        },
    ],
    // Game room - !BLQjREzUgbtIsgrvRn:matrix.org
    '!BLQjREzUgbtIsgrvRn:matrix.org': [
        {
            id: "etherpad",
            url: "http://localhost:8000/etherpad.html",
            name: "Etherpad",
        },
    ],
};

module.exports = React.createClass({
    displayName: 'AppsDrawer',

    propTypes: {
    },

    componentDidMount: function() {
    },

    initAppConfig: function(appConfig) {
        console.log("App props: ", this.props);
        appConfig = appConfig.map(
            (app, index, arr) => {
                switch(app.id) {
                    case 'etherpad':
                        app.url = app.url + '?userName=' + this.props.userId +
                            '&padId=' + this.props.room.roomId;
                    break;
                }

                return app;
            });
        return appConfig;
    },

    getInitialState: function() {
        for (const key in roomWidgetConfig) {
            if(key == this.props.room.roomId) {
                return {
                    apps: this.initAppConfig(roomWidgetConfig[key]),
                };
            }
        }
        return {
            apps: [],
        };
    },

    onClickAddWidget: function() {
        Modal.createDialog(AddAppDialog, {
            onFinished: (proceed, reason) => {
                if (!proceed) return;

                this.state.apps.push();
            },
        });
    },

    render: function() {
        const apps = this.state.apps.map(
            (app, index, arr) => <AppTile
                key={app.id}
                id={app.id}
                url={app.url}
                name={app.name}
                fullWdith={arr.length<2 ? true : false}
                roomId={this.props.roomId}
                userId={this.props.userId}
            />);

        return (
            <div className="mx_AppsDrawer">
                <div id="apps" className="mx_AppsContainer">
                    {apps}
                </div>
                <div onClick={this.onClickAddWidget}
                    role="button"
                    tabIndex="0"
                    className="mx_AddWidget_button"
                    title="Add a widget">
                    [+] Add a widget
                </div>
            </div>
        );
    },
});
