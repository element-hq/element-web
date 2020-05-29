/*
Copyright 2015, 2016 OpenMarket Ltd
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

import React from "react";
import createReactClass from 'create-react-class';

export default createReactClass({
    displayName: 'Spinner',

    render: function() {
        const w = this.props.w || 32;
        const h = this.props.h || 32;
        const imgClass = this.props.imgClassName || "";
        return (
            <div className="mx_Spinner">
                <img src={require("../../../../res/img/spinner.gif")} width={w} height={h} className={imgClass} />
            </div>
        );
    },
});
