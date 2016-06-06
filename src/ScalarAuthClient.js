/*
Copyright 2016 OpenMarket Ltd

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

var q = require("q");
var request = require('browser-request');

var SdkConfig = require('./SdkConfig');

class ScalarAuthClient {
    getScalarToken(openid_token_object) {
        var defer = q.defer();

        var scalar_rest_url = SdkConfig.get().integrations_rest_url;
        request({
            method: 'POST',
            uri: scalar_rest_url+'/register',
            body: openid_token_object,
            json: true,
        }, (err, response, body) => {
            if (err) {
                defer.reject(err);
            } else if (response.statusCode / 100 !== 2) {
                defer.reject({statusCode: response.statusCode});
            } else {
                defer.resolve(body.access_token);
            }
        });

        return defer.promise;
    }
}

module.exports = ScalarAuthClient;

