/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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

import React from 'react';

export default class EncryptionPanel extends React.PureComponent {
    render() {
        const request = this.props.verificationRequest;
        if (request) {
            return <p>got a request, go straight to wizard</p>;
        } else if (this.props.member) {
            return <p>show encryption options for member {this.props.member.name}</p>;
        } else {
            return <p>nada</p>;
        }
    }
}
