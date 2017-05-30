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

module.exports = React.createClass({
    displayName: 'AppsDrawer',

    propTypes: {
    },

    componentDidMount: function() {
    },

    getInitialState: function() {
        return {
            apps: [
                {
                    id: "youtube",
                    url: "https://www.youtube.com/embed/ZJy1ajvMU1k?controls=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1",
                    name: "Live stream - Boeuf Bourguignon",
                },
                {
                    id: "recipie",
                    url: "http://localhost:8000/recepie.html",
                    name: "Ingredients - Boeuf Bourguignon",
                },
            ],
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
            (app) => <AppTile key={app.id} url={app.url} name={app.name}/>);

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
