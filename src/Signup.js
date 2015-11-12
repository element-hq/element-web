"use strict";
var MatrixClientPeg = require("./MatrixClientPeg");
var dis = require("./dispatcher");

class Register {

}

class Login {
    constructor(hsUrl, isUrl) {
        this._hsUrl = hsUrl;
        this._isUrl = isUrl;
        this._currentFlowIndex = 0;
        this._flows = [];
    }

    getFlows() {
        var self = this;
        // feels a bit wrong to be clobbering the global client for something we
        // don't even know if it'll work, but we'll leave this here for now to
        // not complicate matters further. It would be nicer to isolate this
        // logic entirely from the rest of the app though.
        MatrixClientPeg.replaceUsingUrls(
            this._hsUrl,
            this._isUrl
        );
        return MatrixClientPeg.get().loginFlows().then(function(result) {
            self._flows = result.flows;
            self._currentFlowIndex = 0;
            // technically the UI should display options for all flows for the
            // user to then choose one, so return all the flows here.
            return self._flows;
        });
    }

    chooseFlow(flowIndex) {
        this._currentFlowIndex = flowIndex;
    }

    getCurrentFlowStep() {
        // technically the flow can have multiple steps, but no one does this
        // for login so we can ignore it.
        var flowStep = this._flows[this._currentFlowIndex];
        return flowStep ? flowStep.type : null;
    }
}

module.exports.Register = Register;
module.exports.Login = Login;
