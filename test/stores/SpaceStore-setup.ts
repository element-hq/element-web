/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// This needs to be executed before the SpaceStore gets imported but due to ES6 import hoisting we have to do this here.
// SpaceStore reads the SettingsStore which needs the localStorage values set at init time.

localStorage.setItem("mx_labs_feature_feature_spaces", "true");
localStorage.setItem("mx_labs_feature_feature_spaces.all_rooms", "true");
localStorage.setItem("mx_labs_feature_feature_spaces.space_member_dms", "true");
localStorage.setItem("mx_labs_feature_feature_spaces.space_dm_badges", "false");
