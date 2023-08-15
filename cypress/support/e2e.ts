/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

/// <reference types="cypress" />

import "@percy/cypress";
import "cypress-real-events";
import "@testing-library/cypress/add-commands";
import installLogsCollector from "cypress-terminal-report/src/installLogsCollector";

import "./config.json";
import "./homeserver";
import "./login";
import "./labs";
import "./client";
import "./settings";
import "./bot";
import "./clipboard";
import "./util";
import "./app";
import "./percy";
import "./webserver";
import "./views";
import "./iframes";
import "./timeline";
import "./network";
import "./composer";
import "./proxy";
import "./axe";
import "./mailhog";
import "./promise";

installLogsCollector({
    // specify the types of logs to collect (and report to the node console at the end of the test)
    collectTypes: [
        "cons:log",
        "cons:info",
        "cons:warn",
        "cons:error",
        // "cons:debug",
        "cy:log",
        "cy:xhr",
        "cy:fetch",
        "cy:request",
        "cy:intercept",
        "cy:command",
    ],
});
