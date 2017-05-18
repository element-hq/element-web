# Copyright 2017 Vector Creations Ltd
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# genflags.sh - Generates pngs for use with CountryDropdown.js
#
# Dependencies:
#   - imagemagick --with-rsvg (because default imagemagick SVG
#       renderer does not produce accurate results)
#
# This will clone the googlei18n flag repo before converting
# all phonenumber.js-supported country flags (as SVGs) into
# PNGs that can be used by CountryDropdown.js.

# Allow CTRL+C to terminate the script
trap "echo Exited!; exit;" SIGINT SIGTERM

# git clone the google repo to get flag SVGs
git clone git@github.com:googlei18n/region-flags
for f in region-flags/svg/*.svg; do
    # Skip state flags
    if [[ $f =~ [A-Z]{2}-[A-Z]{2,3}.svg ]] ; then
        echo "Skipping state flag "$f
        continue
    fi

    # Skip countries not included in phonenumber.js
    if [[ $f =~ (AC|CP|DG|EA|EU|IC|TA|UM|UN|XK).svg ]] ; then
        echo "Skipping non-phonenumber supported flag "$f
        continue
    fi

    # Run imagemagick convert
    #   -background none : transparent background
    #   -thumbnail 25x15 : resize the flag to have a height of 15.
    #       By default, aspect ratio is respected so the width will
    #       be correct and not necessarily 25px.
    #   -gravity Center  : keep the image central when adding an -extent
    #   -border 1        : add a 1px border around the flag
    #   -bordercolor     : set the border colour
    #   -extent 27x27    : surround the image with padding so that it
    #       has the dimensions 27x27.
    convert $f -background none -thumbnail 25x15  \
    -gravity Center -border 1 -bordercolor \#e0e0e0 \
    -extent 27x27 $f.png

    # $f.png will be region-flags/svg/XX.svg.png at this point

    # Extract filename from path $f
    newname=${f##*/}
    # Replace .svg with .png
    newname=${newname%.svg}.png
    # Move the file to flags directory
    mv $f.png flags/$newname
    echo "Generated flags/"$newname
done
