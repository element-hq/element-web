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
import React from 'react';

class AppIconTile extends React.Component {
    render() {
        return (
            <div className="mx_AppIconTile">
                <div className="mx_AppIconTile_imageContainer">
                    <img src={this.props.icon} alt={this.props.name} className="mx_AppIconTile_image"/>
                </div>
                <div className="mx_AppIconTile_content">
                  <h4><b>{this.props.name}</b></h4>
                  <p>{this.props.description}</p>
                </div>
            </div>
        );
    }
}

AppIconTile.propTypes = {
    type: React.PropTypes.string.isRequired,
    icon: React.PropTypes.string.isRequired,
    name: React.PropTypes.string.isRequired,
    description: React.PropTypes.string.isRequired,
};

export default AppIconTile;
