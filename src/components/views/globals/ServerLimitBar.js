/*
Copyright 2018 New Vector Ltd

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
import sdk from '../../../index';
import { _t } from '../../../languageHandler';

export default React.createClass({
    render: function() {
        const toolbarClasses = "mx_MatrixToolbar mx_MatrixToolbar_error";
        return (
            <div className={toolbarClasses}>
                <div className="mx_MatrixToolbar_content">
                    { _t("This homeserver has hit its Monthly Active User limit. Please contact your service administrator to continue using the service.") }
                </div>
            </div>
        );
    },
});
