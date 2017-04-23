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

var React = require('react');
var DateUtils = require('matrix-react-sdk/lib/DateUtils');
import { getDateAsLabel } from '../../../utils/DateUtils'

module.exports = React.createClass({
    displayName: 'MessageTimestamp',
    
    getInitialState: function() {
        return ({
            timeSpanHover: false,
        });
    },
    
    setVisible: function() {
        this.setState({ timeSpanHover: true });
    },
    
    setInvisible: function() {
        this.setState({ timeSpanHover: false });
    },
    
    render: function() {
        var date = new Date(this.props.ts);
        
        
        var className = 'mx_ContextualMenu_wrapper';
        
        var visibility = this.state.timeSpanHover ? 'visible' : 'hidden';
        var position = {
            position: 'absolute',
            top: '30px',
            left: '2px',
            visibility: visibility,
        };
        
        var menuClass = 'mx_ContextualMenu';
        
        var chevronClassName = 'mx_ContextualMenu_chevron_top';
        var chevronPosition = {
            left: '10px'
        };
        
        var dateStyle = {
            fontSize: '11px'
        };
        
        return (
        <div>
            <span className="mx_MessageTimestamp" onMouseEnter={ this.setVisible } onMouseLeave={ this.setInvisible }>
                { DateUtils.formatTime(date) }
            </span>
            
            <div className={className} style={position}>
              <div className={menuClass}>
                <div className={chevronClassName} style={chevronPosition}>
                </div>
                <div style={dateStyle}>
                    { getDateAsLabel(date) }
                </div>
              </div>
            </div>
        </div>
        );
    },
});

