#!/usr/bin/env bash
# Run this from the project root to create project.zip
zip -r project.zip . -x node_modules/\* .git/\* project.zip
echo "Created project.zip"
