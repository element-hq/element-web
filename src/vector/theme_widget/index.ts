/*
Copyright 2020 New Vector Ltd.

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

// We have to trick webpack into loading our CSS for us.
require("./index.scss");

import * as qs from 'querystring';
import { KnownWidgetActions, WidgetApi } from 'matrix-react-sdk/src/widgets/WidgetApi';

let widgetApi: WidgetApi;
(async function() {
    try {
        // The widget's options are encoded into the fragment to avoid leaking info to the server. The widget
        // spec on the other hand requires the widgetId and parentUrl to show up in the regular query string.
        const widgetQuery = qs.parse(window.location.hash.substring(1));
        const query = Object.assign({}, qs.parse(window.location.search.substring(1)), widgetQuery);
        const qsParam = (name: string, optional = false): string => {
            if (!optional && (!query[name] || typeof (query[name]) !== 'string')) {
                throw new Error(`Expected singular ${name} in query string`);
            }
            return <string>query[name];
        };

        // Set this up as early as possible because Element will be hitting it almost immediately.
        widgetApi = new WidgetApi(qsParam('parentUrl'), qsParam('widgetId'), []);

        widgetApi.on(KnownWidgetActions.ButtonClicked, req => {
            console.log("@@ clickety", req);
            document.getElementById("button").innerText = "BUTTON CLICKED: " + JSON.stringify(req.data);
            setTimeout(() => {
                widgetApi.closeModalWidget(req.data);
            }, 3000);
        });

        widgetApi.on(KnownWidgetActions.GetWidgetConfig, (config) => {
            console.log("Got widget config: ", config);
            document.getElementById("question").innerText = "INIT PARAMS: " + JSON.stringify(config.data);
        });

        document.getElementById("closeButton").onclick = () => {
            widgetApi.closeModalWidget({answer: 42});
        };
    } catch (e) {
        console.error("Error setting up Jitsi widget", e);
        document.getElementById("widgetActionContainer").innerText = "Failed to load Jitsi widget";
    }
})();
