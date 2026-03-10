#!/bin/bash

for letter in {A..Z}; do
  mkdir -p "$letter/characters"
  mkdir -p "$letter/locations"
  mkdir -p "$letter/maps"
  mkdir -p "$letter/house-sigils"
  mkdir -p "$letter/book-covers"
  mkdir -p "$letter/creatures"
  mkdir -p "$letter/weapons"
  mkdir -p "$letter/artwork"
  mkdir -p "$letter/scenes"
done

echo "Directories created successfully."
