/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

const request = require('request-promise-native');
const cheerio = require('cheerio');
const url = require("url");

module.exports.approveConsent = async function(consentUrl) {
    const body = await request.get(consentUrl);
    const doc = cheerio.load(body);
    const v = doc("input[name=v]").val();
    const u = doc("input[name=u]").val();
    const h = doc("input[name=h]").val();
    const formAction = doc("form").attr("action");
    const absAction = url.resolve(consentUrl, formAction);
    await request.post(absAction).form({v, u, h});
};
