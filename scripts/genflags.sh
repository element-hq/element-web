# Copyright 2017-2024 New Vector Ltd.

# SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
# Please see LICENSE in the repository root for full details.


# genflags.sh - Generates pngs for use with CountryDropdown.js
#
# Dependencies:
#   - imagemagick --with-rsvg (because default imagemagick SVG
#       renderer does not produce accurate results)
#
# on macOS, this is most easily done with:
#   brew install imagemagick --with-librsvg
#
# This will clone the googlei18n flag repo before converting
# all phonenumber.js-supported country flags (as SVGs) into
# PNGs that can be used by CountryDropdown.js.

set -e

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
    #   -resize 50x30    : resize the flag to have a height of 15px (2x)
    #       By default, aspect ratio is respected so the width will
    #       be correct and not necessarily 25px.
    #   -filter Lanczos  : use sharper resampling to avoid muddiness
    #   -gravity Center  : keep the image central when adding an -extent
    #   -border 1        : add a 1px border around the flag
    #   -bordercolor     : set the border colour
    #   -extent 54x54    : surround the image with padding so that it
    #       has the dimensions 27x27px (2x).
    convert $f -background none -filter Lanczos -resize 50x30 \
        -gravity Center -border 1 -bordercolor \#e0e0e0 \
        -extent 54x54 $f.png

    # $f.png will be region-flags/svg/XX.svg.png at this point

    # Extract filename from path $f
    newname=${f##*/}
    # Replace .svg with .png
    newname=${newname%.svg}.png
    # Move the file to flags directory
    mv $f.png ../res/flags/$newname
    echo "Generated res/flags/"$newname
done
