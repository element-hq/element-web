#!/usr/bin/env python

"""
Outputs the body of the first entry of changelog file on stdin
"""

import re
import sys

found_first_header = False
for line in sys.stdin:
    line = line.strip()
    if re.match(r"^Changes in \[.*\]", line):
        if found_first_header:
            break
        found_first_header = True
    elif not re.match(r"^=+$", line) and len(line) > 0:
        print line
