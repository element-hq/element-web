/*
Copyright 2021 New Vector Ltd.

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
// add React and ReactPerf to the global namespace, to make them easier to access via the console
// this incidentally means we can forget our React imports in JSX files without penalty.
window.React = React;

import AppTile from "matrix-react-sdk/src/components/views/elements/AppTile";

export interface IStartOpts {
    accessToken: string;
    widgetId: string;
    roomId?: string;
}

export async function loadApp(opts: IStartOpts) {
    // TODO: Actually use `opts` to populate the widget
    return <AppTile
        app={{
            id: "test1234",
            url: "http://localhost:8081/index.html#/?widgetId=$matrix_widget_id",
            name: "Test Widget",
            type: "m.custom",
            data: {},
        }}
        fullWidth={true}
        userId={"@test:example.org"}
        userWidget={true}
    />;
}
