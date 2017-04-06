'use strict';

var React = require('react');

module.exports = React.createClass({
    displayName: 'AutomatedLoginFromParent',
		onMessage(e) {
			/*if (e.origin !== "http://example.com") {
				return;
			}*/
			p = JSON.parse(e.data);
			localStorage.setItem('mx_access_token', JSON.stringify(p.mx_access_token));
      console.log(p);
      console.log(e);
    },
    render: function() {
    		var p={};
    		window.onmessage = function(e) {
    			p = JSON.parse(e.data);
					localStorage.setItem('mx_access_token', JSON.stringify(p.mx_access_token));
      		console.log(p);
      		console.log(e);
    		}
        return (
        	<div className="dtygelTest">dtygelTest {JSON.stringify(p)}</div>
        );
    }
});
