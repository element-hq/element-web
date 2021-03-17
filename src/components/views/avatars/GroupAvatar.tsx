/*
Copyright 2017, 2021 The Matrix.org Foundation C.I.C.

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
import BaseAvatar from './BaseAvatar';
import {replaceableComponent} from "../../../utils/replaceableComponent";
import {mediaFromMxc} from "../../../customisations/Media";
import {ResizeMethod} from "../../../Avatar";

export interface IProps {
        groupId?: string;
        groupName?: string;
        groupAvatarUrl?: string;
        width?: number;
        height?: number;
        resizeMethod?: ResizeMethod;
        onClick?: React.MouseEventHandler;
}

@replaceableComponent("views.avatars.GroupAvatar")
export default class GroupAvatar extends React.Component<IProps> {
    public static defaultProps = {
        width: 36,
        height: 36,
        resizeMethod: 'crop',
    };

    getGroupAvatarUrl() {
        if (!this.props.groupAvatarUrl) return null;
        return mediaFromMxc(this.props.groupAvatarUrl).getThumbnailOfSourceHttp(
            this.props.width,
            this.props.height,
            this.props.resizeMethod,
        );
    }

    render() {
        // extract the props we use from props so we can pass any others through
        // should consider adding this as a global rule in js-sdk?
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const {groupId, groupAvatarUrl, groupName, ...otherProps} = this.props;

        return (
            <BaseAvatar
                name={groupName || this.props.groupId[1]}
                idName={this.props.groupId}
                url={this.getGroupAvatarUrl()}
                {...otherProps}
            />
        );
    }
}
